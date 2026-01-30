namespace CobranzaDigital.Application.Interfaces;

public interface IIdentityService
{
    Task<(bool Success, string UserId, IEnumerable<string> Errors)> CreateUserAsync(string userName, string password);
    Task<bool> CheckPasswordAsync(string userName, string password);
}
