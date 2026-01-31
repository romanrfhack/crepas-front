using CobranzaDigital.Application.Contracts.Auth;

namespace CobranzaDigital.Application.Interfaces;

public interface ITokenService
{
    Task<AuthResponse> CreateTokensAsync(IdentityUserInfo user, CancellationToken cancellationToken = default);
    Task<AuthResponse?> RefreshTokensAsync(string refreshToken, CancellationToken cancellationToken = default);
}
