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

public sealed class AdminUsersAuthorizationHardeningIntegrationTests : IClassFixture<CobranzaDigitalApiFactory>
{
    private readonly CobranzaDigitalApiFactory _factory;
    private readonly HttpClient _client;

    public AdminUsersAuthorizationHardeningIntegrationTests(CobranzaDigitalApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Options_ReturnOnlyRolesAndScopeAllowedForActor()
    {
        var scope = await GetScopeDataAsync();
        await EnsureUserRoleAsync("admin@test.local", "SuperAdmin", null, null);
        var superToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");

        var superOptions = await GetOptionsAsync(superToken);
        Assert.Contains(superOptions.Roles, role => role.Name == "TenantAdmin");
        Assert.DoesNotContain(superOptions.Roles, role => role.Name == "SuperAdmin");
        Assert.Contains(superOptions.Tenants, tenant => tenant.Id == scope.TenantA.Id);
        Assert.Contains(superOptions.Stores, store => store.Id == scope.StoreA.Id);

        var tenantAdminEmail = $"options.tenant.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(tenantAdminEmail, "Temp1234!");
        await EnsureUserRoleAsync(tenantAdminEmail, "TenantAdmin", scope.TenantA.Id, null);
        var tenantAdminToken = await LoginAndGetAccessTokenAsync(tenantAdminEmail, "Temp1234!");

        var tenantOptions = await GetOptionsAsync(tenantAdminToken);
        Assert.Contains(tenantOptions.Roles, role => role.Name == "AdminStore");
        Assert.DoesNotContain(tenantOptions.Roles, role => role.Name is "TenantAdmin" or "SuperAdmin");
        Assert.Single(tenantOptions.Tenants);
        Assert.Equal(scope.TenantA.Id, tenantOptions.Tenants[0].Id);
        Assert.All(tenantOptions.Stores, store => Assert.Equal(scope.TenantA.Id, store.TenantId));

        var adminStoreEmail = $"options.store.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(adminStoreEmail, "Temp1234!");
        await EnsureUserRoleAsync(adminStoreEmail, "AdminStore", scope.TenantA.Id, scope.StoreA.Id);
        var adminStoreToken = await LoginAndGetAccessTokenAsync(adminStoreEmail, "Temp1234!");

        var storeOptions = await GetOptionsAsync(adminStoreToken);
        Assert.Contains(storeOptions.Roles, role => role.Name == "Manager");
        Assert.DoesNotContain(storeOptions.Roles, role => role.Name is "AdminStore" or "TenantAdmin" or "SuperAdmin");
        Assert.Single(storeOptions.Tenants);
        Assert.Single(storeOptions.Stores);
        Assert.Equal(scope.TenantA.Id, storeOptions.Tenants[0].Id);
        Assert.Equal(scope.StoreA.Id, storeOptions.Stores[0].Id);
    }

    [Fact]
    public async Task RoleAssignment_RejectsSuperAdminAndEqualOrHigherRoles()
    {
        var scope = await GetScopeDataAsync();
        await EnsureUserRoleAsync("admin@test.local", "SuperAdmin", null, null);
        var superToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");

        using var superAdminCreation = await CreateAdminUserAsync(superToken, new CreateUserRequest(
            $"roles.create.super.{Guid.NewGuid():N}@test.local",
            $"roles-create-super-{Guid.NewGuid():N}",
            "SuperAdmin",
            null,
            null,
            "Temp1234!"));
        Assert.Equal(HttpStatusCode.BadRequest, superAdminCreation.StatusCode);

        var managerEmail = $"roles.manager.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(managerEmail, "Temp1234!");
        await EnsureUserRoleAsync(managerEmail, "Manager", scope.TenantA.Id, scope.StoreA.Id);
        var managerId = await GetUserIdByEmailAsync(superToken, managerEmail);

        using var superAdminAssignment = await ReplaceRolesAsync(superToken, managerId, ["SuperAdmin"]);
        Assert.Equal(HttpStatusCode.Forbidden, superAdminAssignment.StatusCode);

        var unknownRole = $"UnknownAssignable{Guid.NewGuid():N}";
        await EnsureRoleExistsAsync(unknownRole);
        using var unknownAssignment = await ReplaceRolesAsync(superToken, managerId, [unknownRole]);
        Assert.Equal(HttpStatusCode.BadRequest, unknownAssignment.StatusCode);

        var tenantAdminEmail = $"roles.tenant.actor.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(tenantAdminEmail, "Temp1234!");
        await EnsureUserRoleAsync(tenantAdminEmail, "TenantAdmin", scope.TenantA.Id, null);
        var tenantAdminToken = await LoginAndGetAccessTokenAsync(tenantAdminEmail, "Temp1234!");

        var adminStoreEmail = $"roles.store.target.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(adminStoreEmail, "Temp1234!");
        await EnsureUserRoleAsync(adminStoreEmail, "AdminStore", scope.TenantA.Id, scope.StoreA.Id);
        var adminStoreId = await GetUserIdByEmailAsync(superToken, adminStoreEmail);

        using var tenantAdminAssignment = await ReplaceRolesAsync(tenantAdminToken, adminStoreId, ["TenantAdmin"]);
        Assert.Equal(HttpStatusCode.Forbidden, tenantAdminAssignment.StatusCode);

        var adminStoreActorEmail = $"roles.store.actor.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(adminStoreActorEmail, "Temp1234!");
        await EnsureUserRoleAsync(adminStoreActorEmail, "AdminStore", scope.TenantA.Id, scope.StoreA.Id);
        var adminStoreToken = await LoginAndGetAccessTokenAsync(adminStoreActorEmail, "Temp1234!");

        var cashierEmail = $"roles.cashier.target.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(cashierEmail, "Temp1234!");
        await EnsureUserRoleAsync(cashierEmail, "Cashier", scope.TenantA.Id, scope.StoreA.Id);
        var cashierId = await GetUserIdByEmailAsync(superToken, cashierEmail);

        using var adminStoreAssignment = await ReplaceRolesAsync(adminStoreToken, cashierId, ["AdminStore"]);
        Assert.Equal(HttpStatusCode.Forbidden, adminStoreAssignment.StatusCode);
    }

    [Fact]
    public async Task MutatingEndpoints_RejectTargetWithEqualOrHigherRole()
    {
        var scope = await GetScopeDataAsync();
        await EnsureUserRoleAsync("admin@test.local", "SuperAdmin", null, null);
        var superToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");

        var tenantActorEmail = $"equal.tenant.actor.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(tenantActorEmail, "Temp1234!");
        await EnsureUserRoleAsync(tenantActorEmail, "TenantAdmin", scope.TenantA.Id, null);
        var tenantActorToken = await LoginAndGetAccessTokenAsync(tenantActorEmail, "Temp1234!");

        var tenantTargetEmail = $"equal.tenant.target.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(tenantTargetEmail, "Temp1234!");
        await EnsureUserRoleAsync(tenantTargetEmail, "TenantAdmin", scope.TenantA.Id, null);
        var tenantTargetId = await GetUserIdByEmailAsync(superToken, tenantTargetEmail);

        using var tenantUpdate = await UpdateUserAsync(tenantActorToken, tenantTargetId, new
        {
            userName = "tenant-equal-denied",
            tenantId = scope.TenantA.Id,
            storeId = (Guid?)null
        });
        Assert.Equal(HttpStatusCode.Forbidden, tenantUpdate.StatusCode);

        using var tenantLock = await SetLockAsync(tenantActorToken, tenantTargetId, true);
        Assert.Equal(HttpStatusCode.Forbidden, tenantLock.StatusCode);

        using var tenantPassword = await SetTemporaryPasswordAsync(tenantActorToken, tenantTargetId, "Denied1234!");
        Assert.Equal(HttpStatusCode.Forbidden, tenantPassword.StatusCode);

        var storeActorEmail = $"equal.store.actor.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(storeActorEmail, "Temp1234!");
        await EnsureUserRoleAsync(storeActorEmail, "AdminStore", scope.TenantA.Id, scope.StoreA.Id);
        var storeActorToken = await LoginAndGetAccessTokenAsync(storeActorEmail, "Temp1234!");

        var storeTargetEmail = $"equal.store.target.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(storeTargetEmail, "Temp1234!");
        await EnsureUserRoleAsync(storeTargetEmail, "AdminStore", scope.TenantA.Id, scope.StoreA.Id);
        var storeTargetId = await GetUserIdByEmailAsync(superToken, storeTargetEmail);

        using var storeUpdate = await UpdateUserAsync(storeActorToken, storeTargetId, new
        {
            userName = "store-equal-denied",
            tenantId = scope.TenantA.Id,
            storeId = scope.StoreA.Id
        });
        Assert.Equal(HttpStatusCode.Forbidden, storeUpdate.StatusCode);

        using var storeRoles = await ReplaceRolesAsync(storeActorToken, storeTargetId, ["Manager"]);
        Assert.Equal(HttpStatusCode.Forbidden, storeRoles.StatusCode);
    }

    [Fact]
    public async Task GetUsers_FiltersByHierarchyBeforePaging_ForAdministrativeActors()
    {
        var scope = await GetScopeDataAsync();
        await EnsureUserRoleAsync("admin@test.local", "SuperAdmin", null, null);
        var superToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var prefix = $"hierarchy.{Guid.NewGuid():N}";

        var tenantActorEmail = $"{prefix}.tenant.actor@test.local";
        await RegisterAsync(tenantActorEmail, "Temp1234!");
        await EnsureUserRoleAsync(tenantActorEmail, "TenantAdmin", scope.TenantA.Id, null);
        var tenantToken = await LoginAndGetAccessTokenAsync(tenantActorEmail, "Temp1234!");

        var tenantEqualEmail = $"{prefix}.tenant.equal@test.local";
        await RegisterAsync(tenantEqualEmail, "Temp1234!");
        await EnsureUserRoleAsync(tenantEqualEmail, "TenantAdmin", scope.TenantA.Id, null);

        foreach (var role in new[] { "AdminStore", "Manager", "Cashier", "Collector", "User" })
        {
            var email = $"{prefix}.tenant.{role.ToLowerInvariant()}@test.local";
            await RegisterAsync(email, "Temp1234!");
            await EnsureUserRoleAsync(email, role, scope.TenantA.Id, scope.StoreA.Id);

            var list = await SearchUsersAsync(tenantToken, email);
            Assert.Single(list.Items);
            Assert.Equal(email, list.Items[0].Email, StringComparer.OrdinalIgnoreCase);
        }

        var tenantEqualList = await SearchUsersAsync(tenantToken, tenantEqualEmail);
        Assert.Empty(tenantEqualList.Items);
        Assert.Equal(0, tenantEqualList.Total);

        var adminStoreActorEmail = $"{prefix}.store.actor@test.local";
        await RegisterAsync(adminStoreActorEmail, "Temp1234!");
        await EnsureUserRoleAsync(adminStoreActorEmail, "AdminStore", scope.TenantA.Id, scope.StoreA.Id);
        var adminStoreToken = await LoginAndGetAccessTokenAsync(adminStoreActorEmail, "Temp1234!");

        var adminStoreEqualEmail = $"{prefix}.store.equal@test.local";
        await RegisterAsync(adminStoreEqualEmail, "Temp1234!");
        await EnsureUserRoleAsync(adminStoreEqualEmail, "AdminStore", scope.TenantA.Id, scope.StoreA.Id);

        foreach (var role in new[] { "Manager", "Cashier", "Collector", "User" })
        {
            var email = $"{prefix}.store.{role.ToLowerInvariant()}@test.local";
            await RegisterAsync(email, "Temp1234!");
            await EnsureUserRoleAsync(email, role, scope.TenantA.Id, scope.StoreA.Id);

            var list = await SearchUsersAsync(adminStoreToken, email);
            Assert.Single(list.Items);
            Assert.Equal(email, list.Items[0].Email, StringComparer.OrdinalIgnoreCase);
        }

        var adminStoreEqualList = await SearchUsersAsync(adminStoreToken, adminStoreEqualEmail);
        Assert.Empty(adminStoreEqualList.Items);
        Assert.Equal(0, adminStoreEqualList.Total);

        var otherSuperAdminEmail = $"{prefix}.super.equal@test.local";
        await RegisterAsync(otherSuperAdminEmail, "Temp1234!");
        await EnsureUserRoleAsync(otherSuperAdminEmail, "SuperAdmin", null, null);

        var superEqualList = await SearchUsersAsync(superToken, otherSuperAdminEmail);
        Assert.Empty(superEqualList.Items);
        Assert.Equal(0, superEqualList.Total);
    }

    [Fact]
    public async Task GetUsers_ExcludesUnknownEqualAndHigherRoles_FromPagedTotal()
    {
        var scope = await GetScopeDataAsync();
        await EnsureUserRoleAsync("admin@test.local", "SuperAdmin", null, null);
        var superToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var prefix = $"pagedtotal.{Guid.NewGuid():N}";
        var unknownRole = $"UnknownPaged{Guid.NewGuid():N}";
        await EnsureRoleExistsAsync(unknownRole);

        var visibleManagerEmail = $"{prefix}.manager@test.local";
        await RegisterAsync(visibleManagerEmail, "Temp1234!");
        await EnsureUserRoleAsync(visibleManagerEmail, "Manager", scope.TenantA.Id, scope.StoreA.Id);

        var visibleTenantAdminEmail = $"{prefix}.tenantadmin@test.local";
        await RegisterAsync(visibleTenantAdminEmail, "Temp1234!");
        await EnsureUserRoleAsync(visibleTenantAdminEmail, "TenantAdmin", scope.TenantA.Id, null);

        var hiddenSuperAdminEmail = $"{prefix}.superadmin@test.local";
        await RegisterAsync(hiddenSuperAdminEmail, "Temp1234!");
        await EnsureUserRoleAsync(hiddenSuperAdminEmail, "SuperAdmin", null, null);

        var hiddenUnknownEmail = $"{prefix}.unknown@test.local";
        await RegisterAsync(hiddenUnknownEmail, "Temp1234!");
        await EnsureUserRolesAsync(hiddenUnknownEmail, ["Collector", unknownRole], scope.TenantA.Id, scope.StoreA.Id);

        var page = await SearchUsersAsync(superToken, prefix, page: 1, pageSize: 1);

        Assert.Equal(2, page.Total);
        Assert.Equal(2, page.TotalCount);
        Assert.Single(page.Items);
        Assert.DoesNotContain(page.Items, item => item.Email == hiddenSuperAdminEmail);
        Assert.DoesNotContain(page.Items, item => item.Email == hiddenUnknownEmail);

        var unknownList = await SearchUsersAsync(superToken, hiddenUnknownEmail);
        Assert.Empty(unknownList.Items);
        Assert.Equal(0, unknownList.Total);
    }

    [Fact]
    public async Task MutatingEndpoints_RejectTargetWithUnknownRole()
    {
        var scope = await GetScopeDataAsync();
        await EnsureUserRoleAsync("admin@test.local", "SuperAdmin", null, null);
        var superToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var unknownRole = $"UnknownTarget{Guid.NewGuid():N}";
        await EnsureRoleExistsAsync(unknownRole);

        var targetEmail = $"unknown.target.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(targetEmail, "Temp1234!");
        await EnsureUserRolesAsync(targetEmail, ["Manager", unknownRole], scope.TenantA.Id, scope.StoreA.Id);
        var targetId = await GetUserIdDirectByEmailAsync(targetEmail);

        using var update = await UpdateUserAsync(superToken, targetId, new
        {
            userName = "unknown-target-denied",
            tenantId = scope.TenantA.Id,
            storeId = scope.StoreA.Id
        });
        Assert.Equal(HttpStatusCode.Forbidden, update.StatusCode);

        using var lockUser = await SetLockAsync(superToken, targetId, true);
        Assert.Equal(HttpStatusCode.Forbidden, lockUser.StatusCode);

        using var temporaryPassword = await SetTemporaryPasswordAsync(superToken, targetId, "Denied1234!");
        Assert.Equal(HttpStatusCode.Forbidden, temporaryPassword.StatusCode);
    }

    [Fact]
    public async Task MultiRoleTarget_UsesHighestEffectiveRoleLevel_ForVisibilityAndAdministration()
    {
        var scope = await GetScopeDataAsync();
        var tenantActorEmail = $"multirole.tenant.actor.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(tenantActorEmail, "Temp1234!");
        await EnsureUserRoleAsync(tenantActorEmail, "TenantAdmin", scope.TenantA.Id, null);
        var tenantToken = await LoginAndGetAccessTokenAsync(tenantActorEmail, "Temp1234!");

        var storeActorEmail = $"multirole.store.actor.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(storeActorEmail, "Temp1234!");
        await EnsureUserRoleAsync(storeActorEmail, "AdminStore", scope.TenantA.Id, scope.StoreA.Id);
        var storeToken = await LoginAndGetAccessTokenAsync(storeActorEmail, "Temp1234!");

        var targetEmail = $"multirole.target.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(targetEmail, "Temp1234!");
        await EnsureUserRolesAsync(targetEmail, ["Manager", "AdminStore"], scope.TenantA.Id, scope.StoreA.Id);

        var tenantList = await SearchUsersAsync(tenantToken, targetEmail);
        Assert.Single(tenantList.Items);
        var targetId = tenantList.Items[0].Id;

        var storeList = await SearchUsersAsync(storeToken, targetEmail);
        Assert.Empty(storeList.Items);
        Assert.Equal(0, storeList.Total);

        using var tenantUpdate = await UpdateUserAsync(tenantToken, targetId, new
        {
            userName = "multirole-tenant-updated",
            tenantId = scope.TenantA.Id,
            storeId = scope.StoreA.Id
        });
        Assert.Equal(HttpStatusCode.OK, tenantUpdate.StatusCode);

        using var storeUpdate = await UpdateUserAsync(storeToken, targetId, new
        {
            userName = "multirole-store-denied",
            tenantId = scope.TenantA.Id,
            storeId = scope.StoreA.Id
        });
        Assert.Equal(HttpStatusCode.Forbidden, storeUpdate.StatusCode);
    }

    private async Task<AdminUserOptionsResponse> GetOptionsAsync(string token)
    {
        using var request = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/admin/users/options", token);
        using var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<AdminUserOptionsResponse>();
        Assert.NotNull(payload);
        return payload!;
    }

    private async Task<HttpResponseMessage> ReplaceRolesAsync(string token, string userId, IReadOnlyCollection<string> roles)
    {
        using var request = CreateAuthorizedRequest(HttpMethod.Put, $"/api/v1/admin/users/{userId}/roles", token);
        request.Content = JsonContent.Create(new { roles });
        return await _client.SendAsync(request);
    }

    private async Task<HttpResponseMessage> CreateAdminUserAsync(string token, CreateUserRequest request)
    {
        using var message = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/admin/users", token);
        message.Content = JsonContent.Create(request);
        return await _client.SendAsync(message);
    }

    private async Task<HttpResponseMessage> UpdateUserAsync(string token, string userId, object payload)
    {
        using var request = CreateAuthorizedRequest(HttpMethod.Put, $"/api/v1/admin/users/{userId}", token);
        request.Content = JsonContent.Create(payload);
        return await _client.SendAsync(request);
    }

    private async Task<HttpResponseMessage> SetLockAsync(string token, string userId, bool lockUser)
    {
        using var request = CreateAuthorizedRequest(HttpMethod.Post, $"/api/v1/admin/users/{userId}/lock", token);
        request.Content = JsonContent.Create(new { @lock = lockUser });
        return await _client.SendAsync(request);
    }

    private async Task<HttpResponseMessage> SetTemporaryPasswordAsync(string token, string userId, string password)
    {
        using var request = CreateAuthorizedRequest(HttpMethod.Post, $"/api/v1/admin/users/{userId}/temporary-password", token);
        request.Content = JsonContent.Create(new { temporaryPassword = password });
        return await _client.SendAsync(request);
    }

    private async Task<PagedUsersResponse> SearchUsersAsync(string adminToken, string search, int page = 1, int pageSize = 20)
    {
        using var request = CreateAuthorizedRequest(
            HttpMethod.Get,
            $"/api/v1/admin/users?search={Uri.EscapeDataString(search)}&page={page}&pageSize={pageSize}",
            adminToken);
        using var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<PagedUsersResponse>();
        Assert.NotNull(payload);
        return payload!;
    }

    private async Task<string> GetUserIdByEmailAsync(string adminToken, string email)
    {
        var payload = await SearchUsersAsync(adminToken, email);
        Assert.Single(payload.Items);
        return payload.Items.Single().Id;
    }

    private async Task<string> GetUserIdDirectByEmailAsync(string email)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await userManager.FindByEmailAsync(email);
        Assert.NotNull(user);
        return user!.Id.ToString();
    }

    private static HttpRequestMessage CreateAuthorizedRequest(HttpMethod method, string url, string token)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return request;
    }

    private async Task RegisterAsync(string email, string password)
    {
        await _factory.CreateDefaultUserAsync(email, password);
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
        await EnsureUserRolesAsync(email, [role], tenantId, storeId);
    }

    private async Task EnsureUserRolesAsync(string email, IReadOnlyCollection<string> roles, Guid? tenantId, Guid? storeId)
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

        var addResult = await userManager.AddToRolesAsync(user, roles);
        Assert.True(addResult.Succeeded, string.Join("; ", addResult.Errors.Select(x => x.Description)));

        var updateResult = await userManager.UpdateAsync(user);
        Assert.True(updateResult.Succeeded, string.Join("; ", updateResult.Errors.Select(x => x.Description)));
    }

    private async Task EnsureRoleExistsAsync(string role)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<ApplicationRole>>();
        if (await roleManager.RoleExistsAsync(role))
        {
            return;
        }

        var createResult = await roleManager.CreateAsync(new ApplicationRole { Name = role });
        Assert.True(createResult.Succeeded, string.Join("; ", createResult.Errors.Select(x => x.Description)));
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

    private sealed record ScopeData(Tenant TenantA, Tenant TenantB, Store StoreA, Store StoreB);
    private sealed record AuthTokensResponse(string AccessToken, string RefreshToken);
    private sealed record CreateUserRequest(string Email, string UserName, string Role, Guid? TenantId, Guid? StoreId, string TemporaryPassword);
    private sealed record PagedUsersResponse(int Total, int TotalCount, IReadOnlyList<UserItem> Items);
    private sealed record UserItem(string Id, string Email);
    private sealed record AdminUserOptionsResponse(
        IReadOnlyList<RoleOption> Roles,
        IReadOnlyList<TenantOption> Tenants,
        IReadOnlyList<StoreOption> Stores,
        CurrentScopeOption CurrentScope);
    private sealed record RoleOption(string Name, string DisplayName, string? Description, int Level);
    private sealed record TenantOption(Guid Id, string Name, string? Slug);
    private sealed record StoreOption(Guid Id, Guid TenantId, string Name);
    private sealed record CurrentScopeOption(string Role, Guid? TenantId, string? TenantName, Guid? StoreId, string? StoreName);
}
