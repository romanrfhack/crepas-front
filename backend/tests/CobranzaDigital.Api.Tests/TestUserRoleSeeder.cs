using CobranzaDigital.Infrastructure.Identity;
using CobranzaDigital.Infrastructure.Persistence;

using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace CobranzaDigital.Api.Tests;

internal static class TestUserRoleSeeder
{
    private static readonly HashSet<string> KnownRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "SuperAdmin",
        "TenantAdmin",
        "AdminStore",
        "Manager",
        "Cashier",
        "Collector",
        "User"
    };

    private static readonly HashSet<string> StoreScopedRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "AdminStore",
        "Manager",
        "Cashier",
        "Collector",
        "User"
    };

    public static async Task SetUserRolesDirectlyAsync(IServiceProvider services, string email, IReadOnlyCollection<string> roles)
    {
        var requestedRoles = roles
            .Select(role => role.Trim())
            .Where(role => !string.IsNullOrWhiteSpace(role))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        Assert.NotEmpty(requestedRoles);

        var unknownRoles = requestedRoles.Where(role => !KnownRoles.Contains(role)).ToArray();
        Assert.True(
            unknownRoles.Length == 0,
            $"Test setup requested unknown roles for {email}. Roles=[{string.Join(",", requestedRoles)}]. Unknown=[{string.Join(",", unknownRoles)}].");

        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<ApplicationRole>>();
        var user = await userManager.FindByEmailAsync(email);

        Assert.NotNull(user);

        await EnsureRolesExistAsync(roleManager, email, requestedRoles);
        await EnsureUserScopeForRolesAsync(db, userManager, user!, email, requestedRoles);

        var currentRoles = await userManager.GetRolesAsync(user!);
        if (currentRoles.Count > 0)
        {
            var removeResult = await userManager.RemoveFromRolesAsync(user!, currentRoles);
            Assert.True(
                removeResult.Succeeded,
                FormatIdentityFailure(
                    $"Expected test role replacement to remove current roles. Email={email}. CurrentRoles=[{string.Join(",", currentRoles)}]. RequestedRoles=[{string.Join(",", requestedRoles)}].",
                    removeResult));
        }

        var addResult = await userManager.AddToRolesAsync(user!, requestedRoles);
        Assert.True(
            addResult.Succeeded,
            FormatIdentityFailure(
                $"Expected test role replacement to add requested roles. Email={email}. RequestedRoles=[{string.Join(",", requestedRoles)}].",
                addResult));
    }

    private static async Task EnsureRolesExistAsync(RoleManager<ApplicationRole> roleManager, string email, IReadOnlyCollection<string> roles)
    {
        foreach (var role in roles)
        {
            if (await roleManager.RoleExistsAsync(role))
            {
                continue;
            }

            var createResult = await roleManager.CreateAsync(new ApplicationRole { Name = role });
            Assert.True(
                createResult.Succeeded,
                FormatIdentityFailure($"Expected test role seed to create role. Email={email}. Role={role}.", createResult));
        }
    }

    private static async Task EnsureUserScopeForRolesAsync(
        CobranzaDigitalDbContext db,
        UserManager<ApplicationUser> userManager,
        ApplicationUser user,
        string email,
        IReadOnlyCollection<string> roles)
    {
        var isSuperAdmin = roles.Any(role => string.Equals(role, "SuperAdmin", StringComparison.OrdinalIgnoreCase));
        var requiresTenant = !isSuperAdmin;
        var requiresStore = roles.Any(role => StoreScopedRoles.Contains(role));

        if (isSuperAdmin)
        {
            user.TenantId = null;
            user.StoreId = null;
        }
        else
        {
            if (requiresTenant && !user.TenantId.HasValue)
            {
                user.TenantId = await db.Tenants.AsNoTracking()
                    .OrderBy(tenant => tenant.Name)
                    .Select(tenant => (Guid?)tenant.Id)
                    .FirstOrDefaultAsync();
            }

            if (requiresStore && !user.StoreId.HasValue)
            {
                var store = await db.Stores.AsNoTracking()
                    .Where(store => !user.TenantId.HasValue || store.TenantId == user.TenantId.Value)
                    .OrderBy(store => store.Name)
                    .Select(store => new { store.Id, store.TenantId })
                    .FirstOrDefaultAsync();

                if (store is not null)
                {
                    user.StoreId = store.Id;
                    user.TenantId = store.TenantId;
                }
            }
        }

        Assert.True(
            !requiresTenant || user.TenantId.HasValue,
            $"Expected test setup to resolve tenant scope. Email={email}. Roles=[{string.Join(",", roles)}].");
        Assert.True(
            !requiresStore || user.StoreId.HasValue,
            $"Expected test setup to resolve store scope. Email={email}. Roles=[{string.Join(",", roles)}].");

        var updateResult = await userManager.UpdateAsync(user);
        Assert.True(
            updateResult.Succeeded,
            FormatIdentityFailure(
                $"Expected test setup to persist user scope. Email={email}. Roles=[{string.Join(",", roles)}]. TenantId={user.TenantId}. StoreId={user.StoreId}.",
                updateResult));
    }

    private static string FormatIdentityFailure(string prefix, IdentityResult result)
    {
        return $"{prefix} Errors=[{string.Join("; ", result.Errors.Select(error => $"{error.Code}: {error.Description}"))}]";
    }
}
