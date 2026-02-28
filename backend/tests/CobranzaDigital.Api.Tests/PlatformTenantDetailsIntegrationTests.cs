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

public sealed class PlatformTenantDetailsIntegrationTests : IClassFixture<CobranzaDigitalApiFactory>
{
    private readonly CobranzaDigitalApiFactory _factory;
    private readonly HttpClient _client;
    private readonly Lazy<Task<SeedResult>> _seed;

    public PlatformTenantDetailsIntegrationTests(CobranzaDigitalApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
        _seed = new Lazy<Task<SeedResult>>(SeedAsync);
    }

    [Fact]
    public async Task PlatformTenantDetails_Endpoints_AccessControl_WorksByRole()
    {
        var seed = await GetSeedAsync();
        var superToken = await LoginAsync(seed.SuperAdminEmail, seed.Password);

        foreach (var email in new[] { seed.TenantAdminEmail, seed.AdminStoreEmail, seed.ManagerEmail, seed.CashierEmail })
        {
            var token = await LoginAsync(email, seed.Password);

            using var getRequest = CreateRequest(HttpMethod.Get, $"/api/v1/platform/tenants/{seed.TenantId}", token);
            using var getResponse = await _client.SendAsync(getRequest);
            Assert.Equal(HttpStatusCode.Forbidden, getResponse.StatusCode);

            using var putRequest = CreateRequest(HttpMethod.Put, $"/api/v1/platform/tenants/{seed.TenantId}", token, new
            {
                name = "Ignored",
                slug = "ignored",
                isActive = true,
                verticalId = seed.VerticalId
            });
            using var putResponse = await _client.SendAsync(putRequest);
            Assert.Equal(HttpStatusCode.Forbidden, putResponse.StatusCode);
        }

        using var superGetRequest = CreateRequest(HttpMethod.Get, $"/api/v1/platform/tenants/{seed.TenantId}", superToken);
        using var superGetResponse = await _client.SendAsync(superGetRequest);
        Assert.Equal(HttpStatusCode.OK, superGetResponse.StatusCode);

        using var superPutRequest = CreateRequest(HttpMethod.Put, $"/api/v1/platform/tenants/{seed.TenantId}", superToken, new
        {
            name = "Tenant Updated",
            slug = $"tenant-updated-{Guid.NewGuid():N}",
            isActive = true,
            verticalId = seed.VerticalId
        });
        using var superPutResponse = await _client.SendAsync(superPutRequest);
        Assert.Equal(HttpStatusCode.OK, superPutResponse.StatusCode);
    }

    [Fact]
    public async Task GetTenantDetails_ReturnsFriendlyNames_AndOperationalCounts()
    {
        var seed = await GetSeedAsync();
        var superToken = await LoginAsync(seed.SuperAdminEmail, seed.Password);

        using var request = CreateRequest(HttpMethod.Get, $"/api/v1/platform/tenants/{seed.TenantId}", superToken);
        using var response = await _client.SendAsync(request);
        var payload = await response.Content.ReadFromJsonAsync<PlatformTenantDetailsDto>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(payload);
        Assert.Equal(seed.TenantId, payload!.Id);
        Assert.Equal("Tenant Uno", payload.Name);
        Assert.Equal("tenant-uno", payload.Slug);
        Assert.Equal(seed.VerticalId, payload.VerticalId);
        Assert.Equal("Food", payload.VerticalName);
        Assert.Equal(seed.DefaultStoreId, payload.DefaultStoreId);
        Assert.Equal("Store Uno", payload.DefaultStoreName);
        Assert.Equal(3, payload.StoreCount);
        Assert.Equal(2, payload.ActiveStoreCount);
        Assert.True(payload.HasCatalogTemplate);
        Assert.Equal(seed.CatalogTemplateId, payload.CatalogTemplateId);
        Assert.Equal("Template Food", payload.CatalogTemplateName);
        Assert.Equal(4, payload.UsersCount);
        Assert.Equal(1, payload.UsersWithoutStoreAssignmentCount);
        Assert.Equal(1, payload.StoresWithoutAdminStoreCount);
        Assert.True(payload.CreatedAtUtc <= payload.UpdatedAtUtc);
    }

    [Fact]
    public async Task GetTenantDetails_Returns404_WhenTenantDoesNotExist()
    {
        var seed = await GetSeedAsync();
        var superToken = await LoginAsync(seed.SuperAdminEmail, seed.Password);

        using var request = CreateRequest(HttpMethod.Get, $"/api/v1/platform/tenants/{Guid.NewGuid()}", superToken);
        using var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PutTenantUpdate_UpdatesAllowedFields_AndWritesAudit()
    {
        var seed = await GetSeedAsync();
        var superToken = await LoginAsync(seed.SuperAdminEmail, seed.Password);

        var newSlug = $"tenant-renamed-{Guid.NewGuid():N}";
        using var request = CreateRequest(HttpMethod.Put, $"/api/v1/platform/tenants/{seed.TenantId}", superToken, new
        {
            name = "Tenant Renamed",
            slug = newSlug,
            verticalId = seed.SecondVerticalId,
            isActive = false
        });

        using var response = await _client.SendAsync(request);
        var payload = await response.Content.ReadFromJsonAsync<PlatformTenantDetailsDto>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(payload);
        Assert.Equal("Tenant Renamed", payload!.Name);
        Assert.Equal(newSlug, payload.Slug);
        Assert.Equal(seed.SecondVerticalId, payload.VerticalId);
        Assert.Equal("Retail", payload.VerticalName);
        Assert.False(payload.IsActive);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();

        var tenant = await db.Tenants.AsNoTracking().SingleAsync(x => x.Id == seed.TenantId);
        Assert.Equal("Tenant Renamed", tenant.Name);
        Assert.Equal(newSlug, tenant.Slug);
        Assert.Equal(seed.SecondVerticalId, tenant.VerticalId);
        Assert.False(tenant.IsActive);

        var audit = await db.AuditLogs.AsNoTracking()
            .OrderByDescending(x => x.OccurredAtUtc)
            .FirstOrDefaultAsync(x => x.Action == "UpdateTenant");

        Assert.NotNull(audit);
        Assert.Equal("Tenant", audit!.EntityType);
        Assert.Equal(seed.TenantId.ToString(), audit.EntityId);
        Assert.Contains("Tenant Uno", audit.BeforeJson ?? string.Empty);
        Assert.Contains("Tenant Renamed", audit.AfterJson ?? string.Empty);
    }

    [Fact]
    public async Task PutTenantUpdate_ValidatesDuplicateSlug_AndInvalidVertical()
    {
        var seed = await GetSeedAsync();
        var superToken = await LoginAsync(seed.SuperAdminEmail, seed.Password);

        using var duplicateSlugRequest = CreateRequest(HttpMethod.Put, $"/api/v1/platform/tenants/{seed.TenantId}", superToken, new
        {
            name = "Tenant Uno",
            slug = seed.OtherTenantSlug,
            verticalId = seed.VerticalId,
            isActive = true
        });
        using var duplicateSlugResponse = await _client.SendAsync(duplicateSlugRequest);
        Assert.Equal(HttpStatusCode.BadRequest, duplicateSlugResponse.StatusCode);

        using var invalidVerticalRequest = CreateRequest(HttpMethod.Put, $"/api/v1/platform/tenants/{seed.TenantId}", superToken, new
        {
            name = "Tenant Uno",
            slug = "tenant-uno",
            verticalId = Guid.NewGuid(),
            isActive = true
        });
        using var invalidVerticalResponse = await _client.SendAsync(invalidVerticalRequest);
        Assert.Equal(HttpStatusCode.BadRequest, invalidVerticalResponse.StatusCode);
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
        var vertical2 = new Vertical { Id = Guid.NewGuid(), Name = "Retail", Description = "Retail", IsActive = true, CreatedAtUtc = now, UpdatedAtUtc = now };
        var tenant = new Tenant { Id = Guid.NewGuid(), VerticalId = vertical.Id, Name = "Tenant Uno", Slug = "tenant-uno", IsActive = true, CreatedAtUtc = now, UpdatedAtUtc = now };
        var otherTenant = new Tenant { Id = Guid.NewGuid(), VerticalId = vertical.Id, Name = "Tenant Dos", Slug = "tenant-dos", IsActive = true, CreatedAtUtc = now, UpdatedAtUtc = now };

        var store1 = new Store { Id = Guid.NewGuid(), TenantId = tenant.Id, Name = "Store Uno", IsActive = true, TimeZoneId = "UTC", CreatedAtUtc = now, UpdatedAtUtc = now };
        var store2 = new Store { Id = Guid.NewGuid(), TenantId = tenant.Id, Name = "Store Dos", IsActive = true, TimeZoneId = "UTC", CreatedAtUtc = now, UpdatedAtUtc = now };
        var store3 = new Store { Id = Guid.NewGuid(), TenantId = tenant.Id, Name = "Store Tres", IsActive = false, TimeZoneId = "UTC", CreatedAtUtc = now, UpdatedAtUtc = now };
        var otherTenantStore = new Store { Id = Guid.NewGuid(), TenantId = otherTenant.Id, Name = "Store Other", IsActive = true, TimeZoneId = "UTC", CreatedAtUtc = now, UpdatedAtUtc = now };

        var template = new CatalogTemplate
        {
            Id = Guid.NewGuid(),
            VerticalId = vertical.Id,
            Name = "Template Food",
            Version = "v1",
            IsActive = true,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        db.Verticals.AddRange(vertical, vertical2);
        db.Tenants.AddRange(tenant, otherTenant);
        db.Stores.AddRange(store1, store2, store3, otherTenantStore);
        db.CatalogTemplates.Add(template);
        await db.SaveChangesAsync();

        tenant.DefaultStoreId = store1.Id;
        otherTenant.DefaultStoreId = otherTenantStore.Id;
        db.TenantCatalogTemplates.Add(new TenantCatalogTemplate { TenantId = tenant.Id, CatalogTemplateId = template.Id, UpdatedAtUtc = now });
        await db.SaveChangesAsync();

        var password = "Admin1234!";
        var superAdminEmail = $"superadmin+{Guid.NewGuid():N}@test.local";
        var tenantAdminEmail = $"tenantadmin+{Guid.NewGuid():N}@test.local";
        var adminStoreEmail = $"adminstore+{Guid.NewGuid():N}@test.local";
        var managerEmail = $"manager+{Guid.NewGuid():N}@test.local";
        var cashierEmail = $"cashier+{Guid.NewGuid():N}@test.local";
        var storeAdmin2Email = $"storeadmin2+{Guid.NewGuid():N}@test.local";

        var superAdmin = await EnsureUserAsync(userManager, superAdminEmail, password);
        var tenantAdmin = await EnsureUserAsync(userManager, tenantAdminEmail, password);
        var adminStore = await EnsureUserAsync(userManager, adminStoreEmail, password);
        var manager = await EnsureUserAsync(userManager, managerEmail, password);
        var cashier = await EnsureUserAsync(userManager, cashierEmail, password);
        var storeAdmin2 = await EnsureUserAsync(userManager, storeAdmin2Email, password);

        tenantAdmin.TenantId = tenant.Id;

        adminStore.TenantId = tenant.Id;
        adminStore.StoreId = store1.Id;

        manager.TenantId = tenant.Id;
        manager.StoreId = store2.Id;

        cashier.TenantId = tenant.Id;
        cashier.StoreId = null;

        storeAdmin2.TenantId = tenant.Id;
        storeAdmin2.StoreId = store1.Id;

        await db.SaveChangesAsync();

        await EnsureRoleAsync(userManager, superAdmin, "SuperAdmin");
        await EnsureRoleAsync(userManager, tenantAdmin, "TenantAdmin");
        await EnsureRoleAsync(userManager, adminStore, "AdminStore");
        await EnsureRoleAsync(userManager, manager, "Manager");
        await EnsureRoleAsync(userManager, cashier, "Cashier");
        await EnsureRoleAsync(userManager, storeAdmin2, "AdminStore");

        return new SeedResult(
            superAdminEmail,
            tenantAdminEmail,
            adminStoreEmail,
            managerEmail,
            cashierEmail,
            password,
            tenant.Id,
            vertical.Id,
            vertical2.Id,
            store1.Id,
            template.Id,
            otherTenant.Slug);
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
        var hasRole = await userManager.IsInRoleAsync(user, role);
        if (!hasRole)
        {
            var roleResult = await userManager.AddToRoleAsync(user, role);
            Assert.True(roleResult.Succeeded, string.Join(";", roleResult.Errors.Select(x => x.Description)));
        }
    }

    private async Task<string> LoginAsync(string email, string password)
    {
        using var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, password));
        response.EnsureSuccessStatusCode();
        var payload = await response.Content.ReadFromJsonAsync<TokenResponse>();
        Assert.NotNull(payload);
        return payload!.AccessToken;
    }

    private static HttpRequestMessage CreateRequest(HttpMethod method, string url, string token, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
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
        Guid TenantId,
        Guid VerticalId,
        Guid SecondVerticalId,
        Guid DefaultStoreId,
        Guid CatalogTemplateId,
        string OtherTenantSlug);
}
