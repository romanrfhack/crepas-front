using CobranzaDigital.Application.Contracts.Auth;

namespace CobranzaDigital.Application.Interfaces;

public interface IIdentityService
{
    Task<(bool Success, string UserId, IEnumerable<string> Errors)> CreateUserAsync(string email, string password);
    Task<IdentityUserInfo?> ValidateUserAsync(string email, string password);
    Task<IdentityUserInfo?> GetUserByIdAsync(string userId);
}
