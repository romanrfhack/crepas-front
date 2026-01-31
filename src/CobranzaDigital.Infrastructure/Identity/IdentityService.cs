using CobranzaDigital.Application.Contracts.Auth;
using CobranzaDigital.Application.Interfaces;
using Microsoft.AspNetCore.Identity;

namespace CobranzaDigital.Infrastructure.Identity;

public sealed class IdentityService : IIdentityService
{
    private readonly UserManager<ApplicationUser> _userManager;

    public IdentityService(UserManager<ApplicationUser> userManager)
    {
        _userManager = userManager;
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

        return result.Succeeded
            ? (true, user.Id.ToString(), Array.Empty<string>())
            : (false, string.Empty, result.Errors.Select(error => error.Description));
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

        return new IdentityUserInfo(user.Id.ToString(), user.Email ?? string.Empty, roles);
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
        return new IdentityUserInfo(user.Id.ToString(), user.Email ?? string.Empty, roles);
    }
}
