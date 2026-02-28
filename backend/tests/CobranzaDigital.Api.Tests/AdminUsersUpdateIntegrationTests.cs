using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

using CobranzaDigital.Domain.Entities;
using CobranzaDigital.Infrastructure.Identity;
using CobranzaDigital.Infrastructure.Persistence;

using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace CobranzaDigital.Api.Tests;

public sealed class AdminUsersUpdateIntegrationTests : IClassFixture<CobranzaDigitalApiFactory>
{
    private readonly CobranzaDigitalApiFactory _factory;
    private readonly HttpClient _client;

    public AdminUsersUpdateIntegrationTests(CobranzaDigitalApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task SuperAdmin_CanUpdateUserAcrossValidTenantStore()
    {
        var scope = await GetScopeDataAsync();
        await EnsureUserRoleAsync("admin@test.local", "SuperAdmin", null, null);
        var superToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");

        var targetEmail = $"update.super.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(targetEmail, "Temp1234!");
        await EnsureUserRoleAsync(targetEmail, "Manager", scope.TenantA.Id, scope.StoreA.Id);
        var targetId = await GetUserIdByEmailAsync(superToken, targetEmail);

        using var response = await UpdateUserAsync(superToken, targetId, new
        {
            userName = "updated-super-user",
            tenantId = scope.TenantB.Id,
            storeId = scope.StoreB.Id
        });
        var payload = await response.Content.ReadFromJsonAsync<UserItem>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(payload);
        Assert.Equal("updated-super-user", payload!.UserName);
        Assert.Equal(scope.TenantB.Id, payload.TenantId);
        Assert.Equal(scope.StoreB.Id, payload.StoreId);

        using var getResponse = await GetUsersAsync(superToken, targetEmail);
        var listPayload = await getResponse.Content.ReadFromJsonAsync<PagedUsersResponse>();
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
        Assert.NotNull(listPayload);
        Assert.Single(listPayload!.Items);
        Assert.Equal(scope.TenantB.Id, listPayload.Items[0].TenantId);
        Assert.Equal(scope.StoreB.Id, listPayload.Items[0].StoreId);
    }

    [Fact]
    public async Task TenantAdmin_CanOnlyUpdateInsideOwnTenant()
    {
        var scope = await GetScopeDataAsync();
        var actorEmail = $"update.tenant.actor.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(actorEmail, "Temp1234!");
        await EnsureUserRoleAsync(actorEmail, "TenantAdmin", scope.TenantA.Id, null);
        var actorToken = await LoginAndGetAccessTokenAsync(actorEmail, "Temp1234!");

        var targetInTenant = $"update.tenant.in.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(targetInTenant, "Temp1234!");
        await EnsureUserRoleAsync(targetInTenant, "AdminStore", scope.TenantA.Id, scope.StoreA.Id);
        var targetInTenantId = await GetUserIdByEmailAsync(actorToken, targetInTenant);

        using var allowed = await UpdateUserAsync(actorToken, targetInTenantId, new
        {
            userName = "tenant-updated",
            tenantId = scope.TenantA.Id,
            storeId = scope.StoreA.Id
        });
        Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);

        var superToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        await EnsureUserRoleAsync("admin@test.local", "SuperAdmin", null, null);

        var targetOtherTenant = $"update.tenant.out.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(targetOtherTenant, "Temp1234!");
        await EnsureUserRoleAsync(targetOtherTenant, "Manager", scope.TenantB.Id, scope.StoreB.Id);
        var targetOtherTenantId = await GetUserIdByEmailAsync(superToken, targetOtherTenant);

        using var denied = await UpdateUserAsync(actorToken, targetOtherTenantId, new
        {
            userName = "tenant-denied",
            tenantId = scope.TenantB.Id,
            storeId = scope.StoreB.Id
        });
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
    }

    [Fact]
    public async Task AdminStore_CanOnlyUpdateInsideOwnStore()
    {
        var scope = await GetScopeDataAsync();
        var actorEmail = $"update.store.actor.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(actorEmail, "Temp1234!");
        await EnsureUserRoleAsync(actorEmail, "AdminStore", scope.TenantA.Id, scope.StoreA.Id);
        var actorToken = await LoginAndGetAccessTokenAsync(actorEmail, "Temp1234!");

        var targetEmail = $"update.store.target.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(targetEmail, "Temp1234!");
        await EnsureUserRoleAsync(targetEmail, "Cashier", scope.TenantA.Id, scope.StoreA.Id);
        var targetId = await GetUserIdByEmailAsync(actorToken, targetEmail);

        using var allowed = await UpdateUserAsync(actorToken, targetId, new
        {
            userName = "store-updated",
            tenantId = scope.TenantA.Id,
            storeId = scope.StoreA.Id
        });
        Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);

        using var denied = await UpdateUserAsync(actorToken, targetId, new
        {
            userName = "store-denied",
            tenantId = scope.TenantA.Id,
            storeId = scope.StoreB.Id
        });
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
    }

    [Theory]
    [InlineData("Manager")]
    [InlineData("Cashier")]
    public async Task ManagerAndCashier_CannotUpdateUsers(string role)
    {
        var scope = await GetScopeDataAsync();
        var actorEmail = $"update.noaccess.{role.ToLowerInvariant()}.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(actorEmail, "Temp1234!");
        await EnsureUserRoleAsync(actorEmail, role, scope.TenantA.Id, scope.StoreA.Id);
        var actorToken = await LoginAndGetAccessTokenAsync(actorEmail, "Temp1234!");

        var superToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        await EnsureUserRoleAsync("admin@test.local", "SuperAdmin", null, null);

        var targetEmail = $"update.noaccess.target.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(targetEmail, "Temp1234!");
        await EnsureUserRoleAsync(targetEmail, "Cashier", scope.TenantA.Id, scope.StoreA.Id);
        var targetId = await GetUserIdByEmailAsync(superToken, targetEmail);

        using var response = await UpdateUserAsync(actorToken, targetId, new
        {
            userName = "denied-update",
            tenantId = scope.TenantA.Id,
            storeId = scope.StoreA.Id
        });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task UpdateValidations_ReturnExpectedCodes()
    {
        var scope = await GetScopeDataAsync();
        await EnsureUserRoleAsync("admin@test.local", "SuperAdmin", null, null);
        var superToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");

        var targetEmail = $"update.validation.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(targetEmail, "Temp1234!");
        await EnsureUserRoleAsync(targetEmail, "Cashier", scope.TenantA.Id, scope.StoreA.Id);
        var targetId = await GetUserIdByEmailAsync(superToken, targetEmail);

        using var missingUsername = await UpdateUserAsync(superToken, targetId, new
        {
            userName = "",
            tenantId = scope.TenantA.Id,
            storeId = scope.StoreA.Id
        });
        Assert.Equal(HttpStatusCode.BadRequest, missingUsername.StatusCode);

        var duplicateEmail = $"update.validation.dup.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(duplicateEmail, "Temp1234!");
        await EnsureUserRoleAsync(duplicateEmail, "Cashier", scope.TenantA.Id, scope.StoreA.Id);
        using var duplicateUserName = await UpdateUserAsync(superToken, targetId, new
        {
            userName = await GetUserNameByEmailAsync(duplicateEmail),
            tenantId = scope.TenantA.Id,
            storeId = scope.StoreA.Id
        });
        Assert.Equal(HttpStatusCode.Conflict, duplicateUserName.StatusCode);

        using var missingStore = await UpdateUserAsync(superToken, targetId, new
        {
            userName = "missing-store",
            tenantId = scope.TenantA.Id,
            storeId = (Guid?)null
        });
        Assert.Equal(HttpStatusCode.BadRequest, missingStore.StatusCode);

        using var invalidStoreTenant = await UpdateUserAsync(superToken, targetId, new
        {
            userName = "invalid-store",
            tenantId = scope.TenantA.Id,
            storeId = scope.StoreB.Id
        });
        Assert.Equal(HttpStatusCode.BadRequest, invalidStoreTenant.StatusCode);

        using var notFound = await UpdateUserAsync(superToken, Guid.NewGuid().ToString(), new
        {
            userName = "not-found",
            tenantId = scope.TenantA.Id,
            storeId = scope.StoreA.Id
        });
        Assert.Equal(HttpStatusCode.NotFound, notFound.StatusCode);
    }

    [Fact]
    public async Task UpdateUser_WritesAuditLogWithBeforeAfterAndRoles()
    {
        var scope = await GetScopeDataAsync();
        await EnsureUserRoleAsync("admin@test.local", "SuperAdmin", null, null);
        var superToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");

        var targetEmail = $"update.audit.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(targetEmail, "Temp1234!");
        await EnsureUserRoleAsync(targetEmail, "AdminStore", scope.TenantA.Id, scope.StoreA.Id);
        var targetId = await GetUserIdByEmailAsync(superToken, targetEmail);

        var correlationId = Guid.NewGuid().ToString("N");
        using var response = await UpdateUserAsync(superToken, targetId, new
        {
            userName = "audit-updated",
            tenantId = scope.TenantA.Id,
            storeId = scope.StoreA.Id
        }, correlationId);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        await using var scopeServices = _factory.Services.CreateAsyncScope();
        var db = scopeServices.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();

        var audit = await db.AuditLogs.AsNoTracking()
            .Where(x => x.Action == "UpdateUser" && x.EntityId == targetId)
            .OrderByDescending(x => x.OccurredAt)
            .FirstOrDefaultAsync();

        Assert.NotNull(audit);
        Assert.Equal(correlationId, audit!.CorrelationId);
        Assert.Contains("userName", audit.BeforeJson ?? string.Empty, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("tenantId", audit.AfterJson ?? string.Empty, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("roles", audit.AfterJson ?? string.Empty, StringComparison.OrdinalIgnoreCase);
    }

    private async Task<HttpResponseMessage> UpdateUserAsync(string token, string userId, object payload, string? correlationId = null)
    {
        using var request = CreateAuthorizedRequest(HttpMethod.Put, $"/api/v1/admin/users/{userId}", token, correlationId);
        request.Content = JsonContent.Create(payload);
        return await _client.SendAsync(request);
    }

    private async Task<HttpResponseMessage> GetUsersAsync(string token, string search)
    {
        using var request = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/admin/users?search={Uri.EscapeDataString(search)}", token);
        return await _client.SendAsync(request);
    }

    private static HttpRequestMessage CreateAuthorizedRequest(HttpMethod method, string url, string token, string? correlationId = null)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (!string.IsNullOrWhiteSpace(correlationId))
        {
            request.Headers.Add("X-Correlation-ID", correlationId);
        }

        return request;
    }

    private async Task RegisterAsync(string email, string password)
    {
        using var response = await _client.PostAsJsonAsync("/api/v1/auth/register", new { email, password });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private async Task<string> LoginAndGetAccessTokenAsync(string email, string password)
    {
        using var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email, password });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<AuthTokensResponse>();
        Assert.NotNull(payload);
        return payload!.AccessToken;
    }

    private async Task<string> GetUserIdByEmailAsync(string adminToken, string email)
    {
        using var response = await GetUsersAsync(adminToken, email);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<PagedUsersResponse>();
        Assert.NotNull(payload);
        Assert.Single(payload!.Items);
        return payload.Items.Single().Id;
    }

    private async Task<string> GetUserNameByEmailAsync(string email)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await userManager.FindByEmailAsync(email);
        Assert.NotNull(user);
        return user!.UserName!;
    }

    private async Task<ScopeData> GetScopeDataAsync()
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();

        await EnsureScopeSeedDataAsync(db);

        var tenants = await db.Tenants.AsNoTracking().OrderBy(x => x.Name).Take(2).ToListAsync();
        Assert.True(tenants.Count >= 2, "Expected at least 2 seeded tenants for scope tests.");

        var stores = await db.Stores.AsNoTracking().ToListAsync();
        var storeA = stores.First(x => x.TenantId == tenants[0].Id);
        var storeB = stores.First(x => x.TenantId == tenants[1].Id);

        return new ScopeData(tenants[0], tenants[1], storeA, storeB);
    }

    private static async Task EnsureScopeSeedDataAsync(CobranzaDigitalDbContext db)
    {
        var tenants = await db.Tenants.OrderBy(x => x.Name).ToListAsync();
        if (tenants.Count >= 2)
        {
            return;
        }

        var templateTenant = tenants.FirstOrDefault();
        var verticalId = templateTenant?.VerticalId
            ?? await db.Verticals.AsNoTracking().OrderBy(x => x.Name).Select(x => x.Id).FirstAsync();

        var now = DateTimeOffset.UtcNow;
        var tenant = new Tenant
        {
            Id = Guid.NewGuid(),
            Name = $"Scope Tenant {Guid.NewGuid():N}"[..20],
            Slug = $"scope-tenant-{Guid.NewGuid():N}"[..30],
            VerticalId = verticalId,
            IsActive = true,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        var store = new Store
        {
            Id = Guid.NewGuid(),
            Name = "Scope Store",
            TenantId = tenant.Id,
            IsActive = true,
            TimeZoneId = "America/Mexico_City",
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        db.Tenants.Add(tenant);
        db.Stores.Add(store);
        await db.SaveChangesAsync();

        tenant.DefaultStoreId = store.Id;
        await db.SaveChangesAsync();
    }

    private async Task EnsureUserRoleAsync(string email, string role, Guid? tenantId, Guid? storeId)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        var user = await userManager.FindByEmailAsync(email);
        Assert.NotNull(user);

        user!.TenantId = tenantId;
        user.StoreId = storeId;

        var currentRoles = await userManager.GetRolesAsync(user);
        if (currentRoles.Count > 0)
        {
            var removeResult = await userManager.RemoveFromRolesAsync(user, currentRoles);
            Assert.True(removeResult.Succeeded, string.Join("; ", removeResult.Errors.Select(x => x.Description)));
        }

        var addResult = await userManager.AddToRoleAsync(user, role);
        Assert.True(addResult.Succeeded, string.Join("; ", addResult.Errors.Select(x => x.Description)));

        var updateResult = await userManager.UpdateAsync(user);
        Assert.True(updateResult.Succeeded, string.Join("; ", updateResult.Errors.Select(x => x.Description)));
    }

    private sealed record ScopeData(Tenant TenantA, Tenant TenantB, Store StoreA, Store StoreB);
    private sealed record AuthTokensResponse(string AccessToken, string RefreshToken);
    private sealed record PagedUsersResponse(int Total, IReadOnlyList<UserItem> Items);
    private sealed record UserItem(string Id, string Email, string UserName, IReadOnlyList<string> Roles, Guid? TenantId, Guid? StoreId);
}
