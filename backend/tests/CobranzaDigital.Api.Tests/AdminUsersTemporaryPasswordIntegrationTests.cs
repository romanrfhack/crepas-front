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

public sealed class AdminUsersTemporaryPasswordIntegrationTests : IClassFixture<CobranzaDigitalApiFactory>
{
    private readonly CobranzaDigitalApiFactory _factory;
    private readonly HttpClient _client;

    public AdminUsersTemporaryPasswordIntegrationTests(CobranzaDigitalApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task SuperAdmin_CanSetTemporaryPassword_AndUserCanLoginWithNewPassword()
    {
        var scope = await GetScopeDataAsync();
        await EnsureUserRoleAsync("admin@test.local", "SuperAdmin", null, null);
        var superToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");

        var targetEmail = $"super.reset.target.{Guid.NewGuid():N}@test.local";
        const string oldPassword = "Temp1234!";
        const string newPassword = "Reset1234!";
        await RegisterAsync(targetEmail, oldPassword);
        await EnsureUserRoleAsync(targetEmail, "Manager", scope.TenantA.Id, scope.StoreA.Id);
        var targetId = await GetUserIdByEmailAsync(superToken, targetEmail);

        using var response = await SetTemporaryPasswordAsync(superToken, targetId, new { temporaryPassword = newPassword });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var oldLogin = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email = targetEmail, password = oldPassword });
        Assert.Equal(HttpStatusCode.Unauthorized, oldLogin.StatusCode);

        var targetToken = await LoginAndGetAccessTokenAsync(targetEmail, newPassword);
        Assert.False(string.IsNullOrWhiteSpace(targetToken));
    }

    [Fact]
    public async Task TenantAdmin_CanResetOnlyInsideOwnTenant()
    {
        var scope = await GetScopeDataAsync();

        var actorEmail = $"tenant.actor.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(actorEmail, "Temp1234!");
        await EnsureUserRoleAsync(actorEmail, "TenantAdmin", scope.TenantA.Id, null);
        var actorToken = await LoginAndGetAccessTokenAsync(actorEmail, "Temp1234!");

        var inTenantEmail = $"tenant.in.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(inTenantEmail, "Temp1234!");
        await EnsureUserRoleAsync(inTenantEmail, "Cashier", scope.TenantA.Id, scope.StoreA.Id);
        var inTenantId = await GetUserIdByEmailAsync(actorToken, inTenantEmail);

        using var allowed = await SetTemporaryPasswordAsync(actorToken, inTenantId, new { temporaryPassword = "Tenant1234!" });
        Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);

        var outsideTenantEmail = $"tenant.out.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(outsideTenantEmail, "Temp1234!");
        await EnsureUserRoleAsync(outsideTenantEmail, "Cashier", scope.TenantB.Id, scope.StoreB.Id);
        var superToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var outsideTenantId = await GetUserIdByEmailAsync(superToken, outsideTenantEmail);

        using var denied = await SetTemporaryPasswordAsync(actorToken, outsideTenantId, new { temporaryPassword = "Tenant1234!" });
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
    }

    [Fact]
    public async Task AdminStore_Reset_IsRestrictedByStoreAndTargetRole()
    {
        var scope = await GetScopeDataAsync();

        var actorEmail = $"store.actor.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(actorEmail, "Temp1234!");
        await EnsureUserRoleAsync(actorEmail, "AdminStore", scope.TenantA.Id, scope.StoreA.Id);
        var actorToken = await LoginAndGetAccessTokenAsync(actorEmail, "Temp1234!");

        var managerInStoreEmail = $"store.manager.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(managerInStoreEmail, "Temp1234!");
        await EnsureUserRoleAsync(managerInStoreEmail, "Manager", scope.TenantA.Id, scope.StoreA.Id);
        var managerInStoreId = await GetUserIdByEmailAsync(actorToken, managerInStoreEmail);

        using var allowed = await SetTemporaryPasswordAsync(actorToken, managerInStoreId, new { temporaryPassword = "Store1234!" });
        Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);

        var cashierOtherStoreEmail = $"store.other.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(cashierOtherStoreEmail, "Temp1234!");
        await EnsureUserRoleAsync(cashierOtherStoreEmail, "Cashier", scope.TenantB.Id, scope.StoreB.Id);
        var superToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var cashierOtherStoreId = await GetUserIdByEmailAsync(superToken, cashierOtherStoreEmail);

        using var deniedStore = await SetTemporaryPasswordAsync(actorToken, cashierOtherStoreId, new { temporaryPassword = "Store1234!" });
        Assert.Equal(HttpStatusCode.Forbidden, deniedStore.StatusCode);

        var tenantAdminEmail = $"store.tenantadmin.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(tenantAdminEmail, "Temp1234!");
        await EnsureUserRoleAsync(tenantAdminEmail, "TenantAdmin", scope.TenantA.Id, null);
        var tenantAdminId = await GetUserIdByEmailAsync(superToken, tenantAdminEmail);

        using var deniedRole = await SetTemporaryPasswordAsync(actorToken, tenantAdminId, new { temporaryPassword = "Store1234!" });
        Assert.Equal(HttpStatusCode.Forbidden, deniedRole.StatusCode);

        var superActorId = await GetUserIdByEmailAsync(superToken, "admin@test.local");
        using var deniedSuperAdmin = await SetTemporaryPasswordAsync(actorToken, superActorId, new { temporaryPassword = "Store1234!" });
        Assert.Equal(HttpStatusCode.Forbidden, deniedSuperAdmin.StatusCode);
    }

    [Theory]
    [InlineData("Manager")]
    [InlineData("Cashier")]
    public async Task ManagerAndCashier_CannotCallTemporaryPasswordEndpoint(string role)
    {
        var scope = await GetScopeDataAsync();

        var actorEmail = $"denied.{role.ToLowerInvariant()}.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(actorEmail, "Temp1234!");
        await EnsureUserRoleAsync(actorEmail, role, scope.TenantA.Id, scope.StoreA.Id);
        var actorToken = await LoginAndGetAccessTokenAsync(actorEmail, "Temp1234!");

        var targetEmail = $"denied.target.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(targetEmail, "Temp1234!");
        await EnsureUserRoleAsync(targetEmail, "Cashier", scope.TenantA.Id, scope.StoreA.Id);

        var superToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var targetId = await GetUserIdByEmailAsync(superToken, targetEmail);

        using var denied = await SetTemporaryPasswordAsync(actorToken, targetId, new { temporaryPassword = "Denied1234!" });
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
    }

    [Fact]
    public async Task TemporaryPassword_Validations_AndNotFound_AreReturned()
    {
        await EnsureUserRoleAsync("admin@test.local", "SuperAdmin", null, null);
        var superToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var userId = await GetUserIdByEmailAsync(superToken, "admin@test.local");

        using var missingPassword = await SetTemporaryPasswordAsync(superToken, userId, new { });
        Assert.Equal(HttpStatusCode.BadRequest, missingPassword.StatusCode);

        using var invalidPassword = await SetTemporaryPasswordAsync(superToken, userId, new { temporaryPassword = "123" });
        Assert.Equal(HttpStatusCode.BadRequest, invalidPassword.StatusCode);

        using var notFound = await SetTemporaryPasswordAsync(superToken, Guid.NewGuid().ToString(), new { temporaryPassword = "Valid1234!" });
        Assert.Equal(HttpStatusCode.NotFound, notFound.StatusCode);
    }

    [Fact]
    public async Task TemporaryPasswordReset_WritesAuditLog_WithoutPassword()
    {
        var scope = await GetScopeDataAsync();
        await EnsureUserRoleAsync("admin@test.local", "SuperAdmin", null, null);
        var superToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");

        var targetEmail = $"audit.reset.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(targetEmail, "Temp1234!");
        await EnsureUserRoleAsync(targetEmail, "Manager", scope.TenantA.Id, scope.StoreA.Id);
        var userId = await GetUserIdByEmailAsync(superToken, targetEmail);

        const string correlationId = "test-correlation-reset-password";
        using var request = CreateAuthorizedRequest(HttpMethod.Post, $"/api/v1/admin/users/{userId}/temporary-password", superToken);
        request.Headers.Add("X-Correlation-Id", correlationId);
        request.Content = JsonContent.Create(new { temporaryPassword = "Audit1234!" });

        using var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        await using var serviceScope = _factory.Services.CreateAsyncScope();
        var db = serviceScope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        var audit = await db.AuditLogs.AsNoTracking()
            .Where(x => x.Action == "ResetUserPassword" && x.EntityId == userId)
            .OrderByDescending(x => x.OccurredAt)
            .FirstOrDefaultAsync();

        Assert.NotNull(audit);
        Assert.Equal("User", audit!.EntityType);
        Assert.Equal(correlationId, audit.CorrelationId);
        Assert.DoesNotContain("Audit1234!", audit.AfterJson ?? string.Empty, StringComparison.Ordinal);
        Assert.DoesNotContain("temporaryPassword", audit.AfterJson ?? string.Empty, StringComparison.OrdinalIgnoreCase);
    }

    private async Task<HttpResponseMessage> SetTemporaryPasswordAsync(string token, string userId, object payload)
    {
        using var request = CreateAuthorizedRequest(HttpMethod.Post, $"/api/v1/admin/users/{userId}/temporary-password", token);
        request.Content = JsonContent.Create(payload);
        return await _client.SendAsync(request);
    }

    private static HttpRequestMessage CreateAuthorizedRequest(HttpMethod method, string url, string token)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
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
        using var request = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/admin/users?search={Uri.EscapeDataString(email)}", adminToken);
        using var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<PagedUsersResponse>();
        Assert.NotNull(payload);
        Assert.Single(payload!.Items);
        return payload.Items.Single().Id;
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
