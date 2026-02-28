using System.Security.Claims;

using CobranzaDigital.Application.Common.Exceptions;
using CobranzaDigital.Application.Contracts.Admin;
using CobranzaDigital.Application.Interfaces;
using CobranzaDigital.Infrastructure.Persistence;

using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace CobranzaDigital.Infrastructure.Identity;

public sealed class UserAdminService : IUserAdminService
{
    private static readonly HashSet<string> ProtectedRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "AdminStore",
        "User"
    };

    private static readonly HashSet<string> RolesRequiringStore = new(StringComparer.OrdinalIgnoreCase)
    {
        "AdminStore",
        "Manager",
        "Cashier"
    };

    private static readonly HashSet<string> CreatableRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "TenantAdmin",
        "AdminStore",
        "Manager",
        "Cashier"
    };

    private static readonly HashSet<string> ResettableRolesBySuperAdmin = new(StringComparer.OrdinalIgnoreCase)
    {
        "TenantAdmin",
        "AdminStore",
        "Manager",
        "Cashier"
    };

    private static readonly HashSet<string> ResettableRolesByTenantAdmin = new(StringComparer.OrdinalIgnoreCase)
    {
        "TenantAdmin",
        "AdminStore",
        "Manager",
        "Cashier"
    };

    private static readonly HashSet<string> ResettableRolesByAdminStore = new(StringComparer.OrdinalIgnoreCase)
    {
        "Manager",
        "Cashier"
    };

    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<ApplicationRole> _roleManager;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly CobranzaDigitalDbContext _db;

    public UserAdminService(UserManager<ApplicationUser> userManager, RoleManager<ApplicationRole> roleManager, IHttpContextAccessor httpContextAccessor, CobranzaDigitalDbContext db)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _httpContextAccessor = httpContextAccessor;
        _db = db;
    }

    public async Task<CreateAdminUserResponseDto> CreateUserAsync(CreateAdminUserRequestDto request, CancellationToken cancellationToken)
    {
        var normalizedEmail = request.Email.Trim();
        var normalizedUserName = request.UserName.Trim();
        var normalizedRole = request.Role.Trim();
        var temporaryPassword = request.TemporaryPassword.Trim();

        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(normalizedEmail))
        {
            errors["email"] = ["Email is required."];
        }

        if (string.IsNullOrWhiteSpace(normalizedUserName))
        {
            errors["userName"] = ["UserName is required."];
        }

        if (string.IsNullOrWhiteSpace(normalizedRole))
        {
            errors["role"] = ["Role is required."];
        }

        if (string.IsNullOrWhiteSpace(temporaryPassword))
        {
            errors["temporaryPassword"] = ["TemporaryPassword is required."];
        }

        if (errors.Count > 0)
        {
            throw new ValidationException(errors);
        }

        if (!CreatableRoles.Contains(normalizedRole))
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["role"] = ["Role is invalid for user creation."] });
        }

        if (!await _roleManager.RoleExistsAsync(normalizedRole).ConfigureAwait(false))
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["role"] = ["Role does not exist."] });
        }

        var actor = await ResolveActorScopeAsync(cancellationToken).ConfigureAwait(false);
        ValidateRoleCreation(actor, normalizedRole);

        var (tenantId, storeId) = await ResolveCreateScopeAsync(actor, normalizedRole, request.TenantId, request.StoreId, cancellationToken).ConfigureAwait(false);

        var existingByEmail = await _userManager.FindByEmailAsync(normalizedEmail).ConfigureAwait(false);
        if (existingByEmail is not null)
        {
            throw new ConflictException($"User with email '{normalizedEmail}' already exists.");
        }

        var existingByUserName = await _userManager.FindByNameAsync(normalizedUserName).ConfigureAwait(false);
        if (existingByUserName is not null)
        {
            throw new ConflictException($"User with userName '{normalizedUserName}' already exists.");
        }

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            Email = normalizedEmail,
            UserName = normalizedUserName,
            TenantId = tenantId,
            StoreId = storeId,
            LockoutEnd = null
        };

        EnsureIdentitySuccess(await _userManager.CreateAsync(user, temporaryPassword).ConfigureAwait(false), "Failed to create user.");
        var addRoleResult = await _userManager.AddToRoleAsync(user, normalizedRole).ConfigureAwait(false);
        if (!addRoleResult.Succeeded)
        {
            _ = await _userManager.DeleteAsync(user).ConfigureAwait(false);
            EnsureIdentitySuccess(addRoleResult, "Failed to assign role to user.");
        }

        return new CreateAdminUserResponseDto(
            user.Id.ToString(),
            user.Email ?? string.Empty,
            user.UserName ?? string.Empty,
            [normalizedRole],
            user.TenantId,
            user.StoreId,
            false);
    }

    public async Task<PagedResult<AdminUserDto>> GetUsersAsync(string? search, Guid? tenantId, Guid? storeId, int page, int pageSize, CancellationToken cancellationToken)
    {
        var actor = await ResolveActorScopeAsync(cancellationToken).ConfigureAwait(false);
        var normalizedSearch = search?.Trim();
        var query = _userManager.Users.AsNoTracking();

        query = ApplyScope(query, actor);

        if (actor.IsSuperAdmin)
        {
            if (tenantId.HasValue)
            {
                query = query.Where(user => user.TenantId == tenantId.Value);
            }

            if (storeId.HasValue)
            {
                query = query.Where(user => user.StoreId == storeId.Value);
            }
        }
        else if (actor.IsTenantAdmin)
        {
            if (storeId.HasValue)
            {
                query = query.Where(user => user.StoreId == storeId.Value);
            }
        }

        if (!string.IsNullOrWhiteSpace(normalizedSearch))
        {
            query = query.Where(user =>
                (user.Email != null && user.Email.Contains(normalizedSearch)) ||
                (user.UserName != null && user.UserName.Contains(normalizedSearch)));
        }

        var total = await query.CountAsync(cancellationToken).ConfigureAwait(false);
        var users = await query.OrderBy(user => user.Email).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken).ConfigureAwait(false);

        var mapped = new List<AdminUserDto>(users.Count);
        foreach (var user in users)
        {
            mapped.Add(await MapUserAsync(user).ConfigureAwait(false));
        }

        return new PagedResult<AdminUserDto>(total, mapped);
    }

    public async Task<SetTemporaryPasswordResponseDto> SetTemporaryPasswordAsync(string userId, SetTemporaryPasswordRequestDto request, CancellationToken cancellationToken)
    {
        var temporaryPassword = request.TemporaryPassword.Trim();
        if (string.IsNullOrWhiteSpace(temporaryPassword))
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["temporaryPassword"] = ["TemporaryPassword is required."] });
        }

        var actor = await ResolveActorScopeAsync(cancellationToken).ConfigureAwait(false);
        var user = await FindUserOrThrowAsync(userId).ConfigureAwait(false);
        EnsureInScope(user, actor);

        var targetRoles = (await _userManager.GetRolesAsync(user).ConfigureAwait(false)).ToArray();
        ValidateTargetRoleForTemporaryPassword(actor, targetRoles);

        if (await _userManager.HasPasswordAsync(user).ConfigureAwait(false))
        {
            var removePasswordResult = await _userManager.RemovePasswordAsync(user).ConfigureAwait(false);
            EnsureIdentitySuccess(removePasswordResult, "Failed to clear existing password.");
        }

        var addPasswordResult = await _userManager.AddPasswordAsync(user, temporaryPassword).ConfigureAwait(false);
        EnsurePasswordChangeSuccess(addPasswordResult);

        return new SetTemporaryPasswordResponseDto(
            user.Id.ToString(),
            user.Email ?? string.Empty,
            user.UserName ?? string.Empty,
            targetRoles.ToArray(),
            user.TenantId,
            user.StoreId,
            "Temporary password updated successfully.");
    }

    public async Task<AdminUserDto> GetUserByIdAsync(string userId, CancellationToken cancellationToken)
    {
        var actor = await ResolveActorScopeAsync(cancellationToken).ConfigureAwait(false);
        var user = await FindUserOrThrowAsync(userId).ConfigureAwait(false);
        EnsureInScope(user, actor);
        return await MapUserAsync(user).ConfigureAwait(false);
    }

    public async Task<AdminUserDto> UpdateUserAsync(string userId, UpdateAdminUserRequestDto request, CancellationToken cancellationToken)
    {
        var normalizedUserName = request.UserName.Trim();
        if (string.IsNullOrWhiteSpace(normalizedUserName))
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["userName"] = ["UserName is required."] });
        }

        var actor = await ResolveActorScopeAsync(cancellationToken).ConfigureAwait(false);
        var user = await FindUserOrThrowAsync(userId).ConfigureAwait(false);
        EnsureInScope(user, actor);

        var targetRoles = (await _userManager.GetRolesAsync(user).ConfigureAwait(false)).ToArray();
        ValidateActorUpdateScope(actor, request.TenantId, request.StoreId);
        await ValidateTenantStoreAndRoleConsistencyAsync(request.TenantId, request.StoreId, targetRoles, cancellationToken).ConfigureAwait(false);

        var existingByUserName = await _userManager.FindByNameAsync(normalizedUserName).ConfigureAwait(false);
        if (existingByUserName is not null && existingByUserName.Id != user.Id)
        {
            throw new ConflictException($"User with userName '{normalizedUserName}' already exists.");
        }

        user.UserName = normalizedUserName;
        user.TenantId = request.TenantId;
        user.StoreId = request.StoreId;

        var result = await _userManager.UpdateAsync(user).ConfigureAwait(false);
        EnsureIdentitySuccess(result, "Failed to update user.");

        return await MapUserAsync(user).ConfigureAwait(false);
    }

    public async Task<AdminUserDto> ReplaceUserRolesAsync(string userId, IReadOnlyCollection<string> roles, CancellationToken cancellationToken)
    {
        if (roles.Count == 0)
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["roles"] = ["At least one role is required."] });
        }

        var actor = await ResolveActorScopeAsync(cancellationToken).ConfigureAwait(false);
        var normalizedRoles = roles.Select(role => role.Trim()).Where(role => !string.IsNullOrWhiteSpace(role)).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        if (normalizedRoles.Length == 0)
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["roles"] = ["At least one role is required."] });
        }

        var existingRoleNames = await _roleManager.Roles.AsNoTracking().Select(role => role.Name!).ToListAsync(cancellationToken).ConfigureAwait(false);
        var invalidRoles = normalizedRoles.Where(role => !existingRoleNames.Contains(role, StringComparer.OrdinalIgnoreCase)).ToArray();
        if (invalidRoles.Length > 0)
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["roles"] = [$"Invalid roles: {string.Join(", ", invalidRoles)}."] });
        }

        ValidateRoleAssignment(actor, normalizedRoles);

        var user = await FindUserOrThrowAsync(userId).ConfigureAwait(false);
        EnsureInScope(user, actor);
        await EnsureUserRoleScopeConsistencyAsync(user, normalizedRoles, cancellationToken).ConfigureAwait(false);

        var currentRoles = await _userManager.GetRolesAsync(user).ConfigureAwait(false);
        var rolesToRemove = currentRoles.Except(normalizedRoles, StringComparer.OrdinalIgnoreCase).ToArray();
        var rolesToAdd = normalizedRoles.Except(currentRoles, StringComparer.OrdinalIgnoreCase).ToArray();

        if (rolesToRemove.Length > 0)
        {
            EnsureIdentitySuccess(await _userManager.RemoveFromRolesAsync(user, rolesToRemove).ConfigureAwait(false), "Failed to remove roles from user.");
        }

        if (rolesToAdd.Length > 0)
        {
            EnsureIdentitySuccess(await _userManager.AddToRolesAsync(user, rolesToAdd).ConfigureAwait(false), "Failed to assign roles to user.");
        }

        return await MapUserAsync(user).ConfigureAwait(false);
    }

    public async Task<AdminUserDto> SetUserLockAsync(string userId, bool lockUser, CancellationToken cancellationToken)
    {
        var actor = await ResolveActorScopeAsync(cancellationToken).ConfigureAwait(false);
        var user = await FindUserOrThrowAsync(userId).ConfigureAwait(false);
        EnsureInScope(user, actor);

        var result = await _userManager.SetLockoutEndDateAsync(user, lockUser ? DateTimeOffset.UtcNow.AddYears(100) : null).ConfigureAwait(false);
        EnsureIdentitySuccess(result, "Failed to update user lock state.");

        return await MapUserAsync(user).ConfigureAwait(false);
    }

    public async Task<IReadOnlyCollection<string>> GetRolesAsync(CancellationToken cancellationToken)
    {
        return await _roleManager.Roles.AsNoTracking().OrderBy(role => role.Name).Select(role => role.Name!).ToArrayAsync(cancellationToken).ConfigureAwait(false);
    }

    public async Task CreateRoleAsync(string roleName, CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        var normalizedRoleName = roleName.Trim();
        if (await _roleManager.RoleExistsAsync(normalizedRoleName).ConfigureAwait(false))
        {
            throw new ConflictException($"Role '{normalizedRoleName}' already exists.");
        }

        EnsureIdentitySuccess(await _roleManager.CreateAsync(new ApplicationRole { Name = normalizedRoleName }).ConfigureAwait(false), $"Failed to create role '{normalizedRoleName}'.");
    }

    public async Task DeleteRoleAsync(string roleName, CancellationToken cancellationToken)
    {
        var normalizedRoleName = roleName.Trim();
        if (ProtectedRoles.Contains(normalizedRoleName))
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["name"] = [$"Role '{normalizedRoleName}' is protected and cannot be deleted."] });
        }

        var role = await _roleManager.FindByNameAsync(normalizedRoleName).ConfigureAwait(false);
        if (role is null)
        {
            throw new NotFoundException("Role", normalizedRoleName);
        }

        var usersInRole = await _userManager.GetUsersInRoleAsync(normalizedRoleName).ConfigureAwait(false);
        if (usersInRole.Count > 0)
        {
            throw new ConflictException($"Role '{normalizedRoleName}' has assigned users and cannot be deleted.");
        }

        EnsureIdentitySuccess(await _roleManager.DeleteAsync(role).ConfigureAwait(false), $"Failed to delete role '{normalizedRoleName}'.");
    }

    private static void ValidateRoleCreation(ActorScope actor, string role)
    {
        var allowed = actor.IsSuperAdmin
            ? new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "TenantAdmin", "AdminStore", "Manager", "Cashier" }
            : actor.IsTenantAdmin
                ? new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "TenantAdmin", "AdminStore", "Manager", "Cashier" }
                : actor.IsAdminStore
                    ? new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "Manager", "Cashier" }
                    : throw new ForbiddenException("You do not have access to user administration.");

        if (!allowed.Contains(role))
        {
            throw new ForbiddenException($"Role '{role}' is outside your creation scope.");
        }
    }

    private async Task<(Guid tenantId, Guid? storeId)> ResolveCreateScopeAsync(
        ActorScope actor,
        string role,
        Guid? requestedTenantId,
        Guid? requestedStoreId,
        CancellationToken cancellationToken)
    {
        var requiresStore = RolesRequiringStore.Contains(role);

        if (!requestedTenantId.HasValue)
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["tenantId"] = ["TenantId is required for selected role."] });
        }

        if (requiresStore && !requestedStoreId.HasValue)
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["storeId"] = ["StoreId is required for selected role."] });
        }

        if (actor.IsTenantAdmin && actor.TenantId != requestedTenantId)
        {
            throw new ForbiddenException("Target user is outside your tenant scope.");
        }

        if (actor.IsAdminStore)
        {
            if (actor.TenantId != requestedTenantId)
            {
                throw new ForbiddenException("Target user is outside your tenant scope.");
            }

            if (!requestedStoreId.HasValue || actor.StoreId != requestedStoreId)
            {
                throw new ForbiddenException("Target user is outside your store scope.");
            }
        }

        var tenantExists = await _db.Tenants.AsNoTracking().AnyAsync(x => x.Id == requestedTenantId.Value, cancellationToken).ConfigureAwait(false);
        if (!tenantExists)
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["tenantId"] = ["Tenant does not exist."] });
        }

        if (requestedStoreId.HasValue)
        {
            var storeBelongsToTenant = await _db.Stores.AsNoTracking()
                .AnyAsync(x => x.Id == requestedStoreId.Value && x.TenantId == requestedTenantId.Value, cancellationToken)
                .ConfigureAwait(false);

            if (!storeBelongsToTenant)
            {
                throw new ValidationException(new Dictionary<string, string[]> { ["storeId"] = ["Store does not belong to tenant."] });
            }
        }

        return (requestedTenantId.Value, requestedStoreId);
    }

    private static IQueryable<ApplicationUser> ApplyScope(IQueryable<ApplicationUser> query, ActorScope actor)
    {
        if (actor.IsSuperAdmin)
        {
            return query;
        }

        if (actor.IsTenantAdmin)
        {
            if (!actor.TenantId.HasValue)
            {
                throw new ForbiddenException("TenantAdmin requires tenant scope.");
            }

            return query.Where(user => user.TenantId == actor.TenantId.Value);
        }

        if (actor.IsAdminStore)
        {
            if (!actor.StoreId.HasValue)
            {
                throw new ForbiddenException("AdminStore requires store scope.");
            }

            return query.Where(user => user.StoreId == actor.StoreId.Value);
        }

        throw new ForbiddenException("You do not have access to user administration.");
    }

    private static void EnsureInScope(ApplicationUser target, ActorScope actor)
    {
        if (actor.IsSuperAdmin)
        {
            return;
        }

        if (actor.IsTenantAdmin)
        {
            if (!actor.TenantId.HasValue || target.TenantId != actor.TenantId.Value)
            {
                throw new ForbiddenException("Target user is outside your tenant scope.");
            }

            return;
        }

        if (actor.IsAdminStore)
        {
            if (!actor.StoreId.HasValue || target.StoreId != actor.StoreId.Value)
            {
                throw new ForbiddenException("Target user is outside your store scope.");
            }

            return;
        }

        throw new ForbiddenException("You do not have access to user administration.");
    }

    private static void ValidateRoleAssignment(ActorScope actor, IReadOnlyCollection<string> normalizedRoles)
    {
        var allowed = actor.IsSuperAdmin
            ? new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "SuperAdmin", "TenantAdmin", "AdminStore", "Manager", "Cashier", "User", "Collector" }
            : actor.IsTenantAdmin
                ? new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "TenantAdmin", "AdminStore", "Manager", "Cashier", "User", "Collector" }
                : actor.IsAdminStore
                    ? new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "Manager", "Cashier", "User", "Collector" }
                    : throw new ForbiddenException("You do not have access to assign roles.");

        var disallowed = normalizedRoles.Where(role => !allowed.Contains(role)).ToArray();
        if (disallowed.Length > 0)
        {
            throw new ForbiddenException($"Roles not allowed for your scope: {string.Join(", ", disallowed)}.");
        }
    }

    private static void ValidateActorUpdateScope(ActorScope actor, Guid? tenantId, Guid? storeId)
    {
        if (actor.IsSuperAdmin)
        {
            return;
        }

        if (actor.IsTenantAdmin)
        {
            if (!actor.TenantId.HasValue || actor.TenantId != tenantId)
            {
                throw new ForbiddenException("Target user is outside your tenant scope.");
            }

            return;
        }

        if (actor.IsAdminStore)
        {
            if (!actor.TenantId.HasValue || actor.TenantId != tenantId)
            {
                throw new ForbiddenException("Target user is outside your tenant scope.");
            }

            if (!actor.StoreId.HasValue || actor.StoreId != storeId)
            {
                throw new ForbiddenException("Target user is outside your store scope.");
            }

            return;
        }

        throw new ForbiddenException("You do not have access to user administration.");
    }

    private async Task ValidateTenantStoreAndRoleConsistencyAsync(Guid? tenantId, Guid? storeId, IReadOnlyCollection<string> roles, CancellationToken cancellationToken)
    {
        var requiresTenant = roles.Any(role =>
            string.Equals(role, "TenantAdmin", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, "AdminStore", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, "Manager", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, "Cashier", StringComparison.OrdinalIgnoreCase));

        if (requiresTenant && !tenantId.HasValue)
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["tenantId"] = ["TenantId is required for current user roles."] });
        }

        if (roles.Any(role => RolesRequiringStore.Contains(role)) && !storeId.HasValue)
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["storeId"] = ["StoreId is required for current user roles."] });
        }

        if (tenantId.HasValue)
        {
            var tenantExists = await _db.Tenants.AsNoTracking().AnyAsync(x => x.Id == tenantId.Value, cancellationToken).ConfigureAwait(false);
            if (!tenantExists)
            {
                throw new ValidationException(new Dictionary<string, string[]> { ["tenantId"] = ["Tenant does not exist."] });
            }
        }

        if (storeId.HasValue)
        {
            if (!tenantId.HasValue)
            {
                throw new ValidationException(new Dictionary<string, string[]> { ["tenantId"] = ["TenantId is required when StoreId is provided."] });
            }

            var storeBelongsToTenant = await _db.Stores.AsNoTracking()
                .AnyAsync(x => x.Id == storeId.Value && x.TenantId == tenantId.Value, cancellationToken)
                .ConfigureAwait(false);

            if (!storeBelongsToTenant)
            {
                throw new ValidationException(new Dictionary<string, string[]> { ["storeId"] = ["Store does not belong to tenant."] });
            }
        }
    }

    private async Task EnsureUserRoleScopeConsistencyAsync(ApplicationUser user, IReadOnlyCollection<string> roles, CancellationToken cancellationToken)
    {
        if (roles.Any(role => string.Equals(role, "SuperAdmin", StringComparison.OrdinalIgnoreCase)))
        {
            return;
        }

        if (roles.Any(role => RolesRequiringStore.Contains(role)) && !user.StoreId.HasValue)
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["storeId"] = ["Selected role requires StoreId."] });
        }

        if (user.StoreId.HasValue)
        {
            var belongs = await _db.Stores.AsNoTracking().AnyAsync(s => s.Id == user.StoreId.Value && user.TenantId.HasValue && s.TenantId == user.TenantId.Value, cancellationToken).ConfigureAwait(false);
            if (!belongs)
            {
                throw new ValidationException(new Dictionary<string, string[]> { ["storeId"] = ["Store does not belong to tenant."] });
            }
        }
    }

    private static void ValidateTargetRoleForTemporaryPassword(ActorScope actor, string[] targetRoles)
    {
        if (targetRoles.Length == 0)
        {
            throw new ForbiddenException("Target user has no roles assigned.");
        }

        if (targetRoles.Any(role => string.Equals(role, "SuperAdmin", StringComparison.OrdinalIgnoreCase)))
        {
            throw new ForbiddenException("Resetting temporary password for SuperAdmin is not allowed.");
        }

        var allowed = actor.IsSuperAdmin
            ? ResettableRolesBySuperAdmin
            : actor.IsTenantAdmin
                ? ResettableRolesByTenantAdmin
                : actor.IsAdminStore
                    ? ResettableRolesByAdminStore
                    : throw new ForbiddenException("You do not have access to reset temporary passwords.");

        var scopedRoles = targetRoles
            .Where(role => string.Equals(role, "TenantAdmin", StringComparison.OrdinalIgnoreCase) ||
                           string.Equals(role, "AdminStore", StringComparison.OrdinalIgnoreCase) ||
                           string.Equals(role, "Manager", StringComparison.OrdinalIgnoreCase) ||
                           string.Equals(role, "Cashier", StringComparison.OrdinalIgnoreCase))
            .ToArray();

        if (scopedRoles.Length == 0)
        {
            throw new ForbiddenException("Target user role is outside temporary password reset scope.");
        }

        var disallowed = scopedRoles.Where(role => !allowed.Contains(role)).ToArray();
        if (disallowed.Length > 0)
        {
            throw new ForbiddenException($"Target roles not allowed for your scope: {string.Join(", ", disallowed)}.");
        }
    }

    private async Task<ActorScope> ResolveActorScopeAsync(CancellationToken cancellationToken)
    {
        var user = _httpContextAccessor.HttpContext?.User ?? throw new ForbiddenException("Missing user context.");
        var userIdValue = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdValue, out var userId))
        {
            throw new ForbiddenException("Invalid user context.");
        }

        var actor = await _userManager.FindByIdAsync(userId.ToString()).ConfigureAwait(false) ?? throw new ForbiddenException("User not found.");
        var roles = await _userManager.GetRolesAsync(actor).ConfigureAwait(false);
        cancellationToken.ThrowIfCancellationRequested();

        return new ActorScope(
            roles.Any(r => string.Equals(r, "SuperAdmin", StringComparison.OrdinalIgnoreCase)),
            roles.Any(r => string.Equals(r, "TenantAdmin", StringComparison.OrdinalIgnoreCase)),
            roles.Any(r => string.Equals(r, "AdminStore", StringComparison.OrdinalIgnoreCase)),
            actor.TenantId,
            actor.StoreId);
    }

    private async Task<ApplicationUser> FindUserOrThrowAsync(string userId)
    {
        if (!Guid.TryParse(userId, out var parsedId))
        {
            throw new NotFoundException("User", userId);
        }

        var user = await _userManager.FindByIdAsync(parsedId.ToString()).ConfigureAwait(false);
        return user ?? throw new NotFoundException("User", userId);
    }

    private async Task<AdminUserDto> MapUserAsync(ApplicationUser user)
    {
        var roles = await _userManager.GetRolesAsync(user).ConfigureAwait(false);
        return new AdminUserDto(user.Id.ToString(), user.Email ?? string.Empty, user.UserName ?? string.Empty, roles?.ToArray() ?? [], user.LockoutEnd.HasValue && user.LockoutEnd.Value > DateTimeOffset.UtcNow, user.LockoutEnd, user.TenantId, user.StoreId);
    }

    private static void EnsureIdentitySuccess(IdentityResult result, string message)
    {
        if (!result.Succeeded)
        {
            var errors = string.Join("; ", result.Errors.Select(error => error.Description));
            throw new DomainRuleException($"{message} {errors}".Trim());
        }
    }

    private static void EnsurePasswordChangeSuccess(IdentityResult result)
    {
        if (result.Succeeded)
        {
            return;
        }

        var errors = result.Errors
            .Select(error => error.Description)
            .Where(description => !string.IsNullOrWhiteSpace(description))
            .ToArray();

        throw new ValidationException(new Dictionary<string, string[]>
        {
            ["temporaryPassword"] = errors.Length == 0 ? ["TemporaryPassword does not satisfy password policy."] : errors
        });
    }

    private sealed record ActorScope(bool IsSuperAdmin, bool IsTenantAdmin, bool IsAdminStore, Guid? TenantId, Guid? StoreId);
}
