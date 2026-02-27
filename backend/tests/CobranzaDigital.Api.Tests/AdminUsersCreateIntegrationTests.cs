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

public sealed class AdminUsersCreateIntegrationTests : IClassFixture<CobranzaDigitalApiFactory>
{
    private readonly CobranzaDigitalApiFactory _factory;
    private readonly HttpClient _client;

    public AdminUsersCreateIntegrationTests(CobranzaDigitalApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task SuperAdmin_CanCreate_TenantAndStoreScopedUsers()
    {
        var scope = await GetScopeDataAsync();
        var superToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        await EnsureUserRoleAsync("admin@test.local", "SuperAdmin", null, null);

        var tenantAdminResponse = await CreateAdminUserAsync(superToken, new CreateUserRequest(
            $"super.tenantadmin.{Guid.NewGuid():N}@test.local",
            $"super-tenantadmin-{Guid.NewGuid():N}",
            "TenantAdmin",
            scope.TenantA.Id,
            null,
            "Temp1234!"));
        Assert.Equal(HttpStatusCode.Created, tenantAdminResponse.StatusCode);

        var adminStoreResponse = await CreateAdminUserAsync(superToken, new CreateUserRequest(
            $"super.adminstore.{Guid.NewGuid():N}@test.local",
            $"super-adminstore-{Guid.NewGuid():N}",
            "AdminStore",
            scope.TenantA.Id,
            scope.StoreA.Id,
            "Temp1234!"));
        Assert.Equal(HttpStatusCode.Created, adminStoreResponse.StatusCode);

        var managerResponse = await CreateAdminUserAsync(superToken, new CreateUserRequest(
            $"super.manager.{Guid.NewGuid():N}@test.local",
            $"super-manager-{Guid.NewGuid():N}",
            "Manager",
            scope.TenantA.Id,
            scope.StoreA.Id,
            "Temp1234!"));
        Assert.Equal(HttpStatusCode.Created, managerResponse.StatusCode);

        var cashierResponse = await CreateAdminUserAsync(superToken, new CreateUserRequest(
            $"super.cashier.{Guid.NewGuid():N}@test.local",
            $"super-cashier-{Guid.NewGuid():N}",
            "Cashier",
            scope.TenantA.Id,
            scope.StoreA.Id,
            "Temp1234!"));
        Assert.Equal(HttpStatusCode.Created, cashierResponse.StatusCode);
    }

    [Fact]
    public async Task TenantAdmin_CanCreateOnlyInsideOwnTenant()
    {
        var scope = await GetScopeDataAsync();
        var superToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        await EnsureUserRoleAsync("admin@test.local", "SuperAdmin", null, null);

        var tenantAdminEmail = $"actor.tenantadmin.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(tenantAdminEmail, "Temp1234!");
        await EnsureUserRoleAsync(tenantAdminEmail, "TenantAdmin", scope.TenantA.Id, null);
        var tenantAdminToken = await LoginAndGetAccessTokenAsync(tenantAdminEmail, "Temp1234!");

        using var sameTenantResponse = await CreateAdminUserAsync(tenantAdminToken, new CreateUserRequest(
            $"tenantadmin.manager.{Guid.NewGuid():N}@test.local",
            $"tenantadmin-manager-{Guid.NewGuid():N}",
            "Manager",
            scope.TenantA.Id,
            scope.StoreA.Id,
            "Temp1234!"));
        Assert.Equal(HttpStatusCode.Created, sameTenantResponse.StatusCode);

        using var otherTenantResponse = await CreateAdminUserAsync(tenantAdminToken, new CreateUserRequest(
            $"tenantadmin.denied.{Guid.NewGuid():N}@test.local",
            $"tenantadmin-denied-{Guid.NewGuid():N}",
            "Manager",
            scope.TenantB.Id,
            scope.StoreB.Id,
            "Temp1234!"));
        Assert.Equal(HttpStatusCode.Forbidden, otherTenantResponse.StatusCode);
    }

    [Fact]
    public async Task AdminStore_CanCreateOnlyManagerOrCashier_InOwnStore()
    {
        var scope = await GetScopeDataAsync();
        var actorEmail = $"actor.adminstore.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(actorEmail, "Temp1234!");
        await EnsureUserRoleAsync(actorEmail, "AdminStore", scope.TenantA.Id, scope.StoreA.Id);
        var actorToken = await LoginAndGetAccessTokenAsync(actorEmail, "Temp1234!");

        using var allowed = await CreateAdminUserAsync(actorToken, new CreateUserRequest(
            $"adminstore.manager.{Guid.NewGuid():N}@test.local",
            $"adminstore-manager-{Guid.NewGuid():N}",
            "Manager",
            scope.TenantA.Id,
            scope.StoreA.Id,
            "Temp1234!"));
        Assert.Equal(HttpStatusCode.Created, allowed.StatusCode);

        using var deniedRole = await CreateAdminUserAsync(actorToken, new CreateUserRequest(
            $"adminstore.denied.role.{Guid.NewGuid():N}@test.local",
            $"adminstore-denied-role-{Guid.NewGuid():N}",
            "TenantAdmin",
            scope.TenantA.Id,
            null,
            "Temp1234!"));
        Assert.Equal(HttpStatusCode.Forbidden, deniedRole.StatusCode);

        using var deniedStore = await CreateAdminUserAsync(actorToken, new CreateUserRequest(
            $"adminstore.denied.store.{Guid.NewGuid():N}@test.local",
            $"adminstore-denied-store-{Guid.NewGuid():N}",
            "Cashier",
            scope.TenantA.Id,
            scope.StoreB.Id,
            "Temp1234!"));
        Assert.Equal(HttpStatusCode.Forbidden, deniedStore.StatusCode);
    }

    [Theory]
    [InlineData("Manager")]
    [InlineData("Cashier")]
    public async Task ManagerAndCashier_CannotCreateUsers(string role)
    {
        var scope = await GetScopeDataAsync();
        var actorEmail = $"actor.{role.ToLowerInvariant()}.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(actorEmail, "Temp1234!");
        await EnsureUserRoleAsync(actorEmail, role, scope.TenantA.Id, scope.StoreA.Id);
        var actorToken = await LoginAndGetAccessTokenAsync(actorEmail, "Temp1234!");

        using var response = await CreateAdminUserAsync(actorToken, new CreateUserRequest(
            $"forbidden.create.{Guid.NewGuid():N}@test.local",
            $"forbidden-create-{Guid.NewGuid():N}",
            "Cashier",
            scope.TenantA.Id,
            scope.StoreA.Id,
            "Temp1234!"));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task CreateUser_Validations_EnforceScopeAndUniquenessRules()
    {
        var scope = await GetScopeDataAsync();
        var superToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        await EnsureUserRoleAsync("admin@test.local", "SuperAdmin", null, null);

        var duplicateEmail = $"dup.user.{Guid.NewGuid():N}@test.local";
        using var first = await CreateAdminUserAsync(superToken, new CreateUserRequest(
            duplicateEmail,
            $"dup-user-first-{Guid.NewGuid():N}",
            "Cashier",
            scope.TenantA.Id,
            scope.StoreA.Id,
            "Temp1234!"));
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        using var duplicate = await CreateAdminUserAsync(superToken, new CreateUserRequest(
            duplicateEmail,
            $"dup-user-second-{Guid.NewGuid():N}",
            "Cashier",
            scope.TenantA.Id,
            scope.StoreA.Id,
            "Temp1234!"));
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);

        using var missingStore = await CreateAdminUserAsync(superToken, new CreateUserRequest(
            $"missing.store.{Guid.NewGuid():N}@test.local",
            $"missing-store-{Guid.NewGuid():N}",
            "Cashier",
            scope.TenantA.Id,
            null,
            "Temp1234!"));
        Assert.Equal(HttpStatusCode.BadRequest, missingStore.StatusCode);

        using var mismatchedStoreTenant = await CreateAdminUserAsync(superToken, new CreateUserRequest(
            $"mismatch.store.tenant.{Guid.NewGuid():N}@test.local",
            $"mismatch-store-tenant-{Guid.NewGuid():N}",
            "Manager",
            scope.TenantA.Id,
            scope.StoreB.Id,
            "Temp1234!"));
        Assert.Equal(HttpStatusCode.BadRequest, mismatchedStoreTenant.StatusCode);

        using var invalidRole = await CreateAdminUserAsync(superToken, new CreateUserRequest(
            $"invalid.role.{Guid.NewGuid():N}@test.local",
            $"invalid-role-{Guid.NewGuid():N}",
            "NopeRole",
            scope.TenantA.Id,
            scope.StoreA.Id,
            "Temp1234!"));
        Assert.Equal(HttpStatusCode.BadRequest, invalidRole.StatusCode);
    }

    [Fact]
    public async Task CreateUser_WritesAuditLog()
    {
        var scope = await GetScopeDataAsync();
        var superToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        await EnsureUserRoleAsync("admin@test.local", "SuperAdmin", null, null);

        var email = $"audit.create.{Guid.NewGuid():N}@test.local";
        using var response = await CreateAdminUserAsync(superToken, new CreateUserRequest(
            email,
            $"audit-create-{Guid.NewGuid():N}",
            "Manager",
            scope.TenantA.Id,
            scope.StoreA.Id,
            "Temp1234!"));
        var payload = await response.Content.ReadFromJsonAsync<CreateUserResponse>();

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.NotNull(payload);

        await using var serviceScope = _factory.Services.CreateAsyncScope();
        var db = serviceScope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        var audit = await db.AuditLogs.AsNoTracking()
            .Where(x => x.Action == "CreateUser" && x.EntityId == payload!.Id)
            .OrderByDescending(x => x.OccurredAt)
            .FirstOrDefaultAsync();

        Assert.NotNull(audit);
        Assert.Equal("User", audit!.EntityType);
        Assert.NotNull(audit.UserId);
    }

    [Fact]
    public async Task GetUsers_ReflectsCreatedUsers_ByScope()
    {
        var scope = await GetScopeDataAsync();
        var superToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        await EnsureUserRoleAsync("admin@test.local", "SuperAdmin", null, null);

        var scopedEmail = $"scope.visible.{Guid.NewGuid():N}@test.local";
        await CreateAdminUserAsync(superToken, new CreateUserRequest(
            scopedEmail,
            $"scope-visible-{Guid.NewGuid():N}",
            "Manager",
            scope.TenantA.Id,
            scope.StoreA.Id,
            "Temp1234!"));

        var outOfScopeEmail = $"scope.hidden.{Guid.NewGuid():N}@test.local";
        await CreateAdminUserAsync(superToken, new CreateUserRequest(
            outOfScopeEmail,
            $"scope-hidden-{Guid.NewGuid():N}",
            "Manager",
            scope.TenantB.Id,
            scope.StoreB.Id,
            "Temp1234!"));

        var tenantAdminEmail = $"scope.tenantadmin.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(tenantAdminEmail, "Temp1234!");
        await EnsureUserRoleAsync(tenantAdminEmail, "TenantAdmin", scope.TenantA.Id, null);
        var tenantAdminToken = await LoginAndGetAccessTokenAsync(tenantAdminEmail, "Temp1234!");

        var adminStoreEmail = $"scope.adminstore.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(adminStoreEmail, "Temp1234!");
        await EnsureUserRoleAsync(adminStoreEmail, "AdminStore", scope.TenantA.Id, scope.StoreA.Id);
        var adminStoreToken = await LoginAndGetAccessTokenAsync(adminStoreEmail, "Temp1234!");

        var superList = await SearchUsersAsync(superToken, scopedEmail);
        Assert.Contains(superList.Items, x => string.Equals(x.Email, scopedEmail, StringComparison.OrdinalIgnoreCase));

        var tenantList = await SearchUsersAsync(tenantAdminToken, scopedEmail);
        Assert.Contains(tenantList.Items, x => string.Equals(x.Email, scopedEmail, StringComparison.OrdinalIgnoreCase));
        var tenantCannotSeeOther = await SearchUsersAsync(tenantAdminToken, outOfScopeEmail);
        Assert.DoesNotContain(tenantCannotSeeOther.Items, x => string.Equals(x.Email, outOfScopeEmail, StringComparison.OrdinalIgnoreCase));

        var storeList = await SearchUsersAsync(adminStoreToken, scopedEmail);
        Assert.Contains(storeList.Items, x => string.Equals(x.Email, scopedEmail, StringComparison.OrdinalIgnoreCase));
        var storeCannotSeeOther = await SearchUsersAsync(adminStoreToken, outOfScopeEmail);
        Assert.DoesNotContain(storeCannotSeeOther.Items, x => string.Equals(x.Email, outOfScopeEmail, StringComparison.OrdinalIgnoreCase));
    }

    private async Task<ScopeData> GetScopeDataAsync()
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();

        var tenants = await db.Tenants.AsNoTracking().OrderBy(x => x.Name).Take(2).ToListAsync();
        Assert.True(tenants.Count >= 2, "Expected at least 2 seeded tenants for scope tests.");

        var stores = await db.Stores.AsNoTracking().ToListAsync();
        var storeA = stores.First(x => x.TenantId == tenants[0].Id);
        var storeB = stores.First(x => x.TenantId == tenants[1].Id);

        return new ScopeData(tenants[0], tenants[1], storeA, storeB);
    }

    private async Task<HttpResponseMessage> CreateAdminUserAsync(string token, CreateUserRequest request)
    {
        using var message = new HttpRequestMessage(HttpMethod.Post, "/api/v1/admin/users");
        message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        message.Content = JsonContent.Create(request);
        return await _client.SendAsync(message);
    }

    private async Task<PagedUsersResponse> SearchUsersAsync(string token, string search)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/admin/users?search={Uri.EscapeDataString(search)}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<PagedUsersResponse>();
        Assert.NotNull(payload);
        return payload!;
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
    private sealed record CreateUserRequest(string Email, string UserName, string Role, Guid? TenantId, Guid? StoreId, string TemporaryPassword);
    private sealed record CreateUserResponse(string Id, string Email, string UserName, IReadOnlyList<string> Roles, Guid? TenantId, Guid? StoreId, bool IsLockedOut);
    private sealed record PagedUsersResponse(int Total, IReadOnlyList<UserItem> Items);
    private sealed record UserItem(string Id, string Email, string UserName, IReadOnlyList<string> Roles, Guid? TenantId, Guid? StoreId);
}
