using CobranzaDigital.Application.Common.Exceptions;
using CobranzaDigital.Application.Contracts.Admin;
using CobranzaDigital.Application.Interfaces;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace CobranzaDigital.Infrastructure.Identity;

public sealed class UserAdminService : IUserAdminService
{
    private static readonly HashSet<string> ProtectedRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "Admin",
        "User"
    };

    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<ApplicationRole> _roleManager;

    public UserAdminService(UserManager<ApplicationUser> userManager, RoleManager<ApplicationRole> roleManager)
    {
        _userManager = userManager;
        _roleManager = roleManager;
    }

    public async Task<PagedResult<AdminUserDto>> GetUsersAsync(
        string? search,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var normalizedSearch = search?.Trim();
        var query = _userManager.Users.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(normalizedSearch))
        {
            query = query.Where(user =>
                (user.Email != null && user.Email.Contains(normalizedSearch)) ||
                (user.UserName != null && user.UserName.Contains(normalizedSearch)));
        }

        var total = await query.CountAsync(cancellationToken);

        var users = await query
            .OrderBy(user => user.Email)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var mapped = new List<AdminUserDto>(users.Count);
        foreach (var user in users)
        {
            mapped.Add(await MapUserAsync(user));
        }

        return new PagedResult<AdminUserDto>(total, mapped);
    }

    public async Task<AdminUserDto> GetUserByIdAsync(string userId, CancellationToken cancellationToken)
    {
        var user = await FindUserOrThrowAsync(userId);
        return await MapUserAsync(user);
    }

    public async Task<AdminUserDto> ReplaceUserRolesAsync(
        string userId,
        IReadOnlyCollection<string> roles,
        CancellationToken cancellationToken)
    {
        if (roles.Count == 0)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["roles"] = ["At least one role is required."]
            });
        }

        var normalizedRoles = roles
            .Select(role => role.Trim())
            .Where(role => !string.IsNullOrWhiteSpace(role))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (normalizedRoles.Length == 0)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["roles"] = ["At least one role is required."]
            });
        }

        var existingRoleNames = await _roleManager.Roles
            .AsNoTracking()
            .Select(role => role.Name!)
            .ToListAsync(cancellationToken);

        var invalidRoles = normalizedRoles
            .Where(role => !existingRoleNames.Contains(role, StringComparer.OrdinalIgnoreCase))
            .ToArray();

        if (invalidRoles.Length > 0)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["roles"] = [
                    $"Invalid roles: {string.Join(", ", invalidRoles)}."
                ]
            });
        }

        var user = await FindUserOrThrowAsync(userId);

        var currentRoles = await _userManager.GetRolesAsync(user);
        var rolesToRemove = currentRoles.Except(normalizedRoles, StringComparer.OrdinalIgnoreCase).ToArray();
        var rolesToAdd = normalizedRoles.Except(currentRoles, StringComparer.OrdinalIgnoreCase).ToArray();

        if (rolesToRemove.Length > 0)
        {
            var removeResult = await _userManager.RemoveFromRolesAsync(user, rolesToRemove);
            EnsureIdentitySuccess(removeResult, "Failed to remove roles from user.");
        }

        if (rolesToAdd.Length > 0)
        {
            var addResult = await _userManager.AddToRolesAsync(user, rolesToAdd);
            EnsureIdentitySuccess(addResult, "Failed to assign roles to user.");
        }

        return await MapUserAsync(user);
    }

    public async Task<AdminUserDto> SetUserLockAsync(string userId, bool lockUser, CancellationToken cancellationToken)
    {
        var user = await FindUserOrThrowAsync(userId);

        var result = await _userManager.SetLockoutEndDateAsync(
            user,
            lockUser ? DateTimeOffset.UtcNow.AddYears(100) : null);

        EnsureIdentitySuccess(result, "Failed to update user lock state.");

        return await MapUserAsync(user);
    }

    public async Task<IReadOnlyCollection<string>> GetRolesAsync(CancellationToken cancellationToken)
    {
        return await _roleManager.Roles
            .AsNoTracking()
            .OrderBy(role => role.Name)
            .Select(role => role.Name!)
            .ToArrayAsync(cancellationToken);
    }

    public async Task CreateRoleAsync(string roleName, CancellationToken cancellationToken)
    {
        _ = cancellationToken;

        var normalizedRoleName = roleName.Trim();
        if (await _roleManager.RoleExistsAsync(normalizedRoleName))
        {
            throw new ConflictException($"Role '{normalizedRoleName}' already exists.");
        }

        var result = await _roleManager.CreateAsync(new ApplicationRole { Name = normalizedRoleName });
        EnsureIdentitySuccess(result, $"Failed to create role '{normalizedRoleName}'.");
    }

    public async Task DeleteRoleAsync(string roleName, CancellationToken cancellationToken)
    {
        var normalizedRoleName = roleName.Trim();

        if (ProtectedRoles.Contains(normalizedRoleName))
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["name"] = [$"Role '{normalizedRoleName}' is protected and cannot be deleted."]
            });
        }

        var role = await _roleManager.FindByNameAsync(normalizedRoleName);
        if (role is null)
        {
            throw new NotFoundException("Role", normalizedRoleName);
        }

        var usersInRole = await _userManager.GetUsersInRoleAsync(normalizedRoleName);
        if (usersInRole.Count > 0)
        {
            throw new ConflictException($"Role '{normalizedRoleName}' has assigned users and cannot be deleted.");
        }

        var result = await _roleManager.DeleteAsync(role);
        EnsureIdentitySuccess(result, $"Failed to delete role '{normalizedRoleName}'.");
    }

    private async Task<ApplicationUser> FindUserOrThrowAsync(string userId)
    {
        if (!Guid.TryParse(userId, out var parsedId))
        {
            throw new NotFoundException("User", userId);
        }

        var user = await _userManager.FindByIdAsync(parsedId.ToString());
        return user ?? throw new NotFoundException("User", userId);
    }

    private async Task<AdminUserDto> MapUserAsync(ApplicationUser user)
    {
        var roles = await _userManager.GetRolesAsync(user);
        var rolesRo = roles?.ToArray() ?? Array.Empty<string>();

        return new AdminUserDto(
            user.Id.ToString(),
            user.Email ?? string.Empty,
            user.UserName ?? string.Empty,
            rolesRo,
            user.LockoutEnd.HasValue && user.LockoutEnd.Value > DateTimeOffset.UtcNow,
            user.LockoutEnd);
    }

    private static void EnsureIdentitySuccess(IdentityResult result, string message)
    {
        if (!result.Succeeded)
        {
            var errors = string.Join("; ", result.Errors.Select(error => error.Description));
            throw new DomainRuleException($"{message} {errors}".Trim());
        }
    }
}
