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

        var result = await _userManager.CreateAsync(user, password);

        if (!result.Succeeded)
        {
            return (false, string.Empty, result.Errors.Select(error => error.Description));
        }

        if (!await _roleManager.RoleExistsAsync(DefaultUserRole))
        {
            var createRoleResult = await _roleManager.CreateAsync(new ApplicationRole { Name = DefaultUserRole });
            if (!createRoleResult.Succeeded)
            {
                return (false, string.Empty, createRoleResult.Errors.Select(error => error.Description));
            }
        }

        if (!await _userManager.IsInRoleAsync(user, DefaultUserRole))
        {
            var addRoleResult = await _userManager.AddToRoleAsync(user, DefaultUserRole);
            if (!addRoleResult.Succeeded)
            {
                return (false, string.Empty, addRoleResult.Errors.Select(error => error.Description));
            }
        }

        return (true, user.Id.ToString(), Array.Empty<string>());
    }

    public async Task<IdentityUserInfo?> ValidateUserAsync(string email, string password)
    {
        var user = await _userManager.FindByEmailAsync(email);

        if (user is null)
        {
            return null;
        }

        var isValid = await _userManager.CheckPasswordAsync(user, password);
        if (!isValid)
        {
            return null;
        }

        var roles = await _userManager.GetRolesAsync(user);

        return new IdentityUserInfo(user.Id.ToString(), user.Email ?? string.Empty, (IReadOnlyCollection<string>)roles);
    }

    public async Task<IdentityUserInfo?> GetUserByIdAsync(string userId)
    {
        if (!Guid.TryParse(userId, out var id))
        {
            return null;
        }

        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null)
        {
            return null;
        }

        var roles = await _userManager.GetRolesAsync(user);
        return new IdentityUserInfo(user.Id.ToString(), user.Email ?? string.Empty, (IReadOnlyCollection<string>)roles);
    }
}
