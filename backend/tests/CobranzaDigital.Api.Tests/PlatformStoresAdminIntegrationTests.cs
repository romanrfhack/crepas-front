using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

using CobranzaDigital.Application.Contracts.Auth;
using CobranzaDigital.Application.Contracts.Platform;
using CobranzaDigital.Domain.Entities;
using CobranzaDigital.Infrastructure.Identity;
using CobranzaDigital.Infrastructure.Persistence;

using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace CobranzaDigital.Api.Tests;

public sealed class PlatformStoresAdminIntegrationTests : IClassFixture<CobranzaDigitalApiFactory>
{
    private readonly CobranzaDigitalApiFactory _factory;
    private readonly HttpClient _client;
    private readonly Lazy<Task<SeedResult>> _seed;

    public PlatformStoresAdminIntegrationTests(CobranzaDigitalApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
        _seed = new Lazy<Task<SeedResult>>(SeedAsync);
    }

    [Fact]
    public async Task PlatformStores_Endpoints_AccessControl_WorksByRole()
    {
        var seed = await GetSeedAsync();
        var superToken = await LoginAsync(seed.SuperAdminEmail, seed.Password);

        foreach (var email in new[] { seed.TenantAdminEmail, seed.AdminStoreEmail, seed.ManagerEmail, seed.CashierEmail })
        {
            var token = await LoginAsync(email, seed.Password);
            using var getStoresRequest = CreateRequest(HttpMethod.Get, $"/api/v1/platform/tenants/{seed.Tenant1Id}/stores", token);
            using var getStoresResponse = await _client.SendAsync(getStoresRequest);
            Assert.Equal(HttpStatusCode.Forbidden, getStoresResponse.StatusCode);

            using var getStoreRequest = CreateRequest(HttpMethod.Get, $"/api/v1/platform/stores/{seed.Store1Id}", token);
            using var getStoreResponse = await _client.SendAsync(getStoreRequest);
            Assert.Equal(HttpStatusCode.Forbidden, getStoreResponse.StatusCode);

            using var putStoreRequest = CreateRequest(HttpMethod.Put, $"/api/v1/platform/stores/{seed.Store1Id}", token, new { name = "ignored", timeZoneId = "UTC", isActive = true });
            using var putStoreResponse = await _client.SendAsync(putStoreRequest);
            Assert.Equal(HttpStatusCode.Forbidden, putStoreResponse.StatusCode);

            using var putDefaultRequest = CreateRequest(HttpMethod.Put, $"/api/v1/platform/tenants/{seed.Tenant1Id}/default-store", token, new { defaultStoreId = seed.Store2Id });
            using var putDefaultResponse = await _client.SendAsync(putDefaultRequest);
            Assert.Equal(HttpStatusCode.Forbidden, putDefaultResponse.StatusCode);
        }

        using var getStoresRequest = CreateRequest(HttpMethod.Get, $"/api/v1/platform/tenants/{seed.Tenant1Id}/stores", superToken);
        using var getStoresResponse = await _client.SendAsync(getStoresRequest);
        Assert.Equal(HttpStatusCode.OK, getStoresResponse.StatusCode);

        using var getStoreRequest = CreateRequest(HttpMethod.Get, $"/api/v1/platform/stores/{seed.Store1Id}", superToken);
        using var getStoreResponse = await _client.SendAsync(getStoreRequest);
        Assert.Equal(HttpStatusCode.OK, getStoreResponse.StatusCode);

        using var updateStoreRequest = CreateRequest(HttpMethod.Put, $"/api/v1/platform/stores/{seed.Store1Id}", superToken, new
        {
            name = "Store A Updated",
            timeZoneId = "UTC",
            isActive = true
        });
        using var updateStoreResponse = await _client.SendAsync(updateStoreRequest);
        Assert.Equal(HttpStatusCode.OK, updateStoreResponse.StatusCode);

        using var updateDefaultRequest = CreateRequest(HttpMethod.Put, $"/api/v1/platform/tenants/{seed.Tenant1Id}/default-store", superToken, new { defaultStoreId = seed.Store2Id });
        using var updateDefaultResponse = await _client.SendAsync(updateDefaultRequest);
        Assert.Equal(HttpStatusCode.NoContent, updateDefaultResponse.StatusCode);
    }

    [Fact]
    public async Task GetTenantStores_ReturnsStores_DefaultFlag_AndHasAdminStore()
    {
        var seed = await GetSeedAsync();
        var superToken = await LoginAsync(seed.SuperAdminEmail, seed.Password);

        using var request = CreateRequest(HttpMethod.Get, $"/api/v1/platform/tenants/{seed.Tenant1Id}/stores", superToken);
        using var response = await _client.SendAsync(request);
        var payload = await response.Content.ReadFromJsonAsync<IReadOnlyList<PlatformTenantStoreListItemDto>>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(payload);
        Assert.Equal(2, payload!.Count);

        var store1 = Assert.Single(payload.Where(x => x.Id == seed.Store1Id));
        var store2 = Assert.Single(payload.Where(x => x.Id == seed.Store2Id));

        Assert.True(store1.IsDefaultStore);
        Assert.True(store1.HasAdminStore);
        Assert.Equal(1, store1.AdminStoreUserCount);

        Assert.False(store2.IsDefaultStore);
        Assert.False(store2.HasAdminStore);
        Assert.Equal(0, store2.AdminStoreUserCount);
    }

    [Fact]
    public async Task GetStoreDetails_ReturnsDetails_And404WhenNotFound()
    {
        var seed = await GetSeedAsync();
        var superToken = await LoginAsync(seed.SuperAdminEmail, seed.Password);

        using var request = CreateRequest(HttpMethod.Get, $"/api/v1/platform/stores/{seed.Store1Id}", superToken);
        using var response = await _client.SendAsync(request);
        var payload = await response.Content.ReadFromJsonAsync<PlatformStoreDetailsDto>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(payload);
        Assert.Equal(seed.Store1Id, payload!.Id);
        Assert.Equal(seed.Tenant1Id, payload.TenantId);
        Assert.True(payload.IsDefaultStore);
        Assert.True(payload.HasAdminStore);

        using var notFoundRequest = CreateRequest(HttpMethod.Get, $"/api/v1/platform/stores/{Guid.NewGuid()}", superToken);
        using var notFoundResponse = await _client.SendAsync(notFoundRequest);
        Assert.Equal(HttpStatusCode.NotFound, notFoundResponse.StatusCode);
    }

    [Fact]
    public async Task UpdateStore_UpdatesAllowedFields_AndWritesAudit()
    {
        var seed = await GetSeedAsync();
        var superToken = await LoginAsync(seed.SuperAdminEmail, seed.Password);

        using var request = CreateRequest(HttpMethod.Put, $"/api/v1/platform/stores/{seed.Store2Id}", superToken, new
        {
            name = "Store A2 Renamed",
            timeZoneId = "America/Mexico_City",
            isActive = false
        });

        using var response = await _client.SendAsync(request);
        var payload = await response.Content.ReadFromJsonAsync<PlatformStoreDetailsDto>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(payload);
        Assert.Equal("Store A2 Renamed", payload!.Name);
        Assert.Equal("America/Mexico_City", payload.TimeZoneId);
        Assert.False(payload.IsActive);

        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        var store = await db.Stores.AsNoTracking().SingleAsync(x => x.Id == seed.Store2Id);
        Assert.Equal("Store A2 Renamed", store.Name);
        Assert.Equal("America/Mexico_City", store.TimeZoneId);
        Assert.False(store.IsActive);

        var audit = await db.AuditLogs.AsNoTracking().OrderByDescending(x => x.OccurredAtUtc).FirstOrDefaultAsync(x => x.Action == "UpdateStore");
        Assert.NotNull(audit);
        Assert.Equal("Store", audit!.EntityType);
        Assert.Equal(seed.Store2Id.ToString(), audit.EntityId);
        Assert.Contains("Store A2", audit.BeforeJson ?? string.Empty);
        Assert.Contains("Store A2 Renamed", audit.AfterJson ?? string.Empty);
    }

    [Fact]
    public async Task UpdateTenantDefaultStore_ChangesValue_RejectsOtherTenantStore_AndWritesAudit()
    {
        var seed = await GetSeedAsync();
        var superToken = await LoginAsync(seed.SuperAdminEmail, seed.Password);

        using var request = CreateRequest(HttpMethod.Put, $"/api/v1/platform/tenants/{seed.Tenant1Id}/default-store", superToken, new { defaultStoreId = seed.Store2Id });
        using var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        var tenant = await db.Tenants.AsNoTracking().SingleAsync(x => x.Id == seed.Tenant1Id);
        Assert.Equal(seed.Store2Id, tenant.DefaultStoreId);

        var audit = await db.AuditLogs.AsNoTracking().OrderByDescending(x => x.OccurredAtUtc).FirstOrDefaultAsync(x => x.Action == "UpdateTenantDefaultStore");
        Assert.NotNull(audit);
        Assert.Equal("Tenant", audit!.EntityType);
        Assert.Equal(seed.Tenant1Id.ToString(), audit.EntityId);
        Assert.Contains(seed.Store1Id.ToString(), audit.BeforeJson ?? string.Empty);
        Assert.Contains(seed.Store2Id.ToString(), audit.AfterJson ?? string.Empty);

        using var invalidRequest = CreateRequest(HttpMethod.Put, $"/api/v1/platform/tenants/{seed.Tenant1Id}/default-store", superToken, new { defaultStoreId = seed.Tenant2StoreId });
        using var invalidResponse = await _client.SendAsync(invalidRequest);
        Assert.Equal(HttpStatusCode.BadRequest, invalidResponse.StatusCode);
    }

    [Fact]
    public async Task HasAdminStore_DoesNotDependOnLegacyAdminRole()
    {
        var seed = await GetSeedAsync();
        var superToken = await LoginAsync(seed.SuperAdminEmail, seed.Password);

        using var request = CreateRequest(HttpMethod.Get, $"/api/v1/platform/tenants/{seed.Tenant1Id}/stores", superToken);
        using var response = await _client.SendAsync(request);
        var payload = await response.Content.ReadFromJsonAsync<IReadOnlyList<PlatformTenantStoreListItemDto>>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var legacyAdminOnlyStore = Assert.Single(payload!.Where(x => x.Id == seed.Store2Id));
        Assert.False(legacyAdminOnlyStore.HasAdminStore);
        Assert.Equal(0, legacyAdminOnlyStore.AdminStoreUserCount);
    }

    private async Task<SeedResult> GetSeedAsync() => await _seed.Value;

    private async Task<SeedResult> SeedAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();

        await db.Database.EnsureDeletedAsync();
        await db.Database.EnsureCreatedAsync();
        await IdentitySeeder.SeedAsync(scope.ServiceProvider, configuration);

        var now = DateTimeOffset.UtcNow;
        var vertical = new Vertical { Id = Guid.NewGuid(), Name = "Food", Description = "Food", IsActive = true, CreatedAtUtc = now, UpdatedAtUtc = now };
        var tenant1 = new Tenant { Id = Guid.NewGuid(), VerticalId = vertical.Id, Name = "Tenant One", Slug = "tenant-one", IsActive = true, CreatedAtUtc = now, UpdatedAtUtc = now };
        var tenant2 = new Tenant { Id = Guid.NewGuid(), VerticalId = vertical.Id, Name = "Tenant Two", Slug = "tenant-two", IsActive = true, CreatedAtUtc = now, UpdatedAtUtc = now };
        var store1 = new Store { Id = Guid.NewGuid(), TenantId = tenant1.Id, Name = "Store A1", IsActive = true, TimeZoneId = "UTC", CreatedAtUtc = now, UpdatedAtUtc = now };
        var store2 = new Store { Id = Guid.NewGuid(), TenantId = tenant1.Id, Name = "Store A2", IsActive = true, TimeZoneId = "UTC", CreatedAtUtc = now, UpdatedAtUtc = now };
        var tenant2Store = new Store { Id = Guid.NewGuid(), TenantId = tenant2.Id, Name = "Store B1", IsActive = true, TimeZoneId = "UTC", CreatedAtUtc = now, UpdatedAtUtc = now };

        tenant1.DefaultStoreId = store1.Id;
        tenant2.DefaultStoreId = tenant2Store.Id;

        db.Verticals.Add(vertical);
        db.Tenants.AddRange(tenant1, tenant2);
        db.Stores.AddRange(store1, store2, tenant2Store);
        await db.SaveChangesAsync();

        var superAdminEmail = "admin@test.local";
        var password = "Admin1234!";

        var tenantAdminEmail = $"tenantadmin+{Guid.NewGuid():N}@test.local";
        var adminStoreEmail = $"adminstore+{Guid.NewGuid():N}@test.local";
        var managerEmail = $"manager+{Guid.NewGuid():N}@test.local";
        var cashierEmail = $"cashier+{Guid.NewGuid():N}@test.local";
        var storeAdminEmail = $"storeadmin+{Guid.NewGuid():N}@test.local";
        var legacyAdminEmail = $"legacyadmin+{Guid.NewGuid():N}@test.local";

        var tenantAdmin = await EnsureUserAsync(userManager, tenantAdminEmail, password);
        tenantAdmin.TenantId = tenant1.Id;

        var adminStore = await EnsureUserAsync(userManager, adminStoreEmail, password);
        adminStore.TenantId = tenant1.Id;
        adminStore.StoreId = store1.Id;

        var manager = await EnsureUserAsync(userManager, managerEmail, password);
        manager.TenantId = tenant1.Id;
        manager.StoreId = store1.Id;

        var cashier = await EnsureUserAsync(userManager, cashierEmail, password);
        cashier.TenantId = tenant1.Id;
        cashier.StoreId = store1.Id;

        var adminStoreUser = await EnsureUserAsync(userManager, storeAdminEmail, password);
        adminStoreUser.TenantId = tenant1.Id;
        adminStoreUser.StoreId = store1.Id;

        var legacyAdminUser = await EnsureUserAsync(userManager, legacyAdminEmail, password);
        legacyAdminUser.TenantId = tenant1.Id;
        legacyAdminUser.StoreId = store2.Id;

        await db.SaveChangesAsync();

        await EnsureRoleAsync(userManager, tenantAdmin, "TenantAdmin");
        await EnsureRoleAsync(userManager, adminStore, "AdminStore");
        await EnsureRoleAsync(userManager, manager, "Manager");
        await EnsureRoleAsync(userManager, cashier, "Cashier");
        await EnsureRoleAsync(userManager, adminStoreUser, "AdminStore");

        var legacyRole = await db.Roles.SingleOrDefaultAsync(x => x.Name == "Admin");
        if (legacyRole is null)
        {
            legacyRole = new ApplicationRole { Id = Guid.NewGuid(), Name = "Admin", NormalizedName = "ADMIN" };
            db.Roles.Add(legacyRole);
            await db.SaveChangesAsync();
        }

        var hasLegacyAssignment = await db.UserRoles.AnyAsync(x => x.UserId == legacyAdminUser.Id && x.RoleId == legacyRole.Id);
        if (!hasLegacyAssignment)
        {
            db.UserRoles.Add(new IdentityUserRole<Guid> { UserId = legacyAdminUser.Id, RoleId = legacyRole.Id });
            await db.SaveChangesAsync();
        }

        return new SeedResult(
            superAdminEmail,
            tenantAdminEmail,
            adminStoreEmail,
            managerEmail,
            cashierEmail,
            password,
            tenant1.Id,
            store1.Id,
            store2.Id,
            tenant2Store.Id);
    }

    private static async Task<ApplicationUser> EnsureUserAsync(UserManager<ApplicationUser> userManager, string email, string password)
    {
        var existing = await userManager.FindByEmailAsync(email);
        if (existing is not null)
        {
            return existing;
        }

        var created = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            EmailConfirmed = true
        };

        var result = await userManager.CreateAsync(created, password);
        Assert.True(result.Succeeded, string.Join(";", result.Errors.Select(x => x.Description)));
        return created;
    }

    private static async Task EnsureRoleAsync(UserManager<ApplicationUser> userManager, ApplicationUser user, string role)
    {
        if (!await userManager.IsInRoleAsync(user, role))
        {
            var result = await userManager.AddToRoleAsync(user, role);
            Assert.True(result.Succeeded, string.Join(";", result.Errors.Select(x => x.Description)));
        }
    }

    private async Task<string> LoginAsync(string email, string password)
    {
        using var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email, password });
        var payload = await response.Content.ReadFromJsonAsync<AuthTokensResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return payload!.AccessToken;
    }

    private static HttpRequestMessage CreateRequest(HttpMethod method, string path, string token, object? body = null)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return request;
    }

    private sealed record SeedResult(
        string SuperAdminEmail,
        string TenantAdminEmail,
        string AdminStoreEmail,
        string ManagerEmail,
        string CashierEmail,
        string Password,
        Guid Tenant1Id,
        Guid Store1Id,
        Guid Store2Id,
        Guid Tenant2StoreId);
}
