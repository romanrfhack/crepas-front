using CobranzaDigital.Application.Contracts.Auth;
using CobranzaDigital.Application.Interfaces;
using Microsoft.AspNetCore.Identity;

namespace CobranzaDigital.Infrastructure.Identity;

public sealed class IdentityService : IIdentityService
{
    private const string DefaultUserRole = "User";

    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<ApplicationRole> _roleManager;

    public IdentityService(UserManager<ApplicationUser> userManager, RoleManager<ApplicationRole> roleManager)
    {
        _userManager = userManager;
        _roleManager = roleManager;
    }

    public async Task<(bool Success, string UserId, IEnumerable<string> Errors)> CreateUserAsync(
        string email,
        string password)
    {
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email
        };

        var result = await _userManager.CreateAsync(user, password).ConfigureAwait(false);

        if (!result.Succeeded)
        {
            return (false, string.Empty, result.Errors.Select(error => error.Description));
        }

        if (!await _roleManager.RoleExistsAsync(DefaultUserRole).ConfigureAwait(false))
        {
            var createRoleResult = await _roleManager.CreateAsync(new ApplicationRole { Name = DefaultUserRole }).ConfigureAwait(false);
            if (!createRoleResult.Succeeded)
            {
                return (false, string.Empty, createRoleResult.Errors.Select(error => error.Description));
            }
        }

        if (!await _userManager.IsInRoleAsync(user, DefaultUserRole).ConfigureAwait(false))
        {
            var addRoleResult = await _userManager.AddToRoleAsync(user, DefaultUserRole).ConfigureAwait(false);
            if (!addRoleResult.Succeeded)
            {
                return (false, string.Empty, addRoleResult.Errors.Select(error => error.Description));
            }
        }

        return (true, user.Id.ToString(), Array.Empty<string>());
    }

    public async Task<IdentityUserInfo?> ValidateUserAsync(string email, string password)
    {
        var user = await _userManager.FindByEmailAsync(email).ConfigureAwait(false);

        if (user is null)
        {
            return null;
        }

        var isValid = await _userManager.CheckPasswordAsync(user, password).ConfigureAwait(false);
        if (!isValid)
        {
            return null;
        }

        var roles = await _userManager.GetRolesAsync(user).ConfigureAwait(false);

        return new IdentityUserInfo(user.Id.ToString(), user.Email ?? string.Empty, (IReadOnlyCollection<string>)roles);
    }

    public async Task<IdentityUserInfo?> GetUserByIdAsync(string userId)
    {
        if (!Guid.TryParse(userId, out var id))
        {
            return null;
        }

        var user = await _userManager.FindByIdAsync(id.ToString()).ConfigureAwait(false);
        if (user is null)
        {
            return null;
        }

        var roles = await _userManager.GetRolesAsync(user).ConfigureAwait(false);
        return new IdentityUserInfo(user.Id.ToString(), user.Email ?? string.Empty, (IReadOnlyCollection<string>)roles);
    }
}
