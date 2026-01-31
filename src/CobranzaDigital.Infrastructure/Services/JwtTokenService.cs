using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using CobranzaDigital.Application.Contracts.Auth;
using CobranzaDigital.Application.Interfaces;
using CobranzaDigital.Application.Options;
using CobranzaDigital.Domain.Entities;
using CobranzaDigital.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace CobranzaDigital.Infrastructure.Services;

public sealed class JwtTokenService : ITokenService
{
    private readonly CobranzaDigitalDbContext _dbContext;
    private readonly IDateTime _dateTime;
    private readonly IIdentityService _identityService;
    private readonly JwtOptions _jwtOptions;

    public JwtTokenService(
        CobranzaDigitalDbContext dbContext,
        IDateTime dateTime,
        IIdentityService identityService,
        IOptions<JwtOptions> jwtOptions)
    {
        _dbContext = dbContext;
        _dateTime = dateTime;
        _identityService = identityService;
        _jwtOptions = jwtOptions.Value;
    }

    public async Task<AuthResponse> CreateTokensAsync(
        IdentityUserInfo user,
        CancellationToken cancellationToken = default)
    {
        var now = _dateTime.UtcNow;
        var accessTokenExpiresAt = now.AddMinutes(_jwtOptions.AccessTokenMinutes);
        var accessToken = CreateAccessToken(user, accessTokenExpiresAt);

        var refreshToken = GenerateRefreshToken();
        var refreshTokenHash = HashToken(refreshToken);

        var refreshEntity = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = Guid.Parse(user.UserId),
            TokenHash = refreshTokenHash,
            CreatedAt = now,
            ExpiresAt = now.AddDays(_jwtOptions.RefreshTokenDays)
        };

        _dbContext.RefreshTokens.Add(refreshEntity);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new AuthResponse(accessToken, refreshToken, accessTokenExpiresAt);
    }

    public async Task<AuthResponse?> RefreshTokensAsync(
        string refreshToken,
        CancellationToken cancellationToken = default)
    {
        var tokenHash = HashToken(refreshToken);
        var storedToken = await _dbContext.RefreshTokens
            .FirstOrDefaultAsync(token => token.TokenHash == tokenHash, cancellationToken);

        if (storedToken is null || storedToken.RevokedAt is not null)
        {
            return null;
        }

        var now = _dateTime.UtcNow;
        if (storedToken.ExpiresAt <= now)
        {
            return null;
        }

        var user = await _identityService.GetUserByIdAsync(storedToken.UserId.ToString());
        if (user is null)
        {
            return null;
        }

        var accessTokenExpiresAt = now.AddMinutes(_jwtOptions.AccessTokenMinutes);
        var accessToken = CreateAccessToken(user, accessTokenExpiresAt);

        var newRefreshToken = GenerateRefreshToken();
        var newRefreshTokenHash = HashToken(newRefreshToken);

        storedToken.RevokedAt = now;
        storedToken.ReplacedByTokenHash = newRefreshTokenHash;

        var refreshEntity = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = Guid.Parse(user.UserId),
            TokenHash = newRefreshTokenHash,
            CreatedAt = now,
            ExpiresAt = now.AddDays(_jwtOptions.RefreshTokenDays)
        };

        _dbContext.RefreshTokens.Add(refreshEntity);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new AuthResponse(accessToken, newRefreshToken, accessTokenExpiresAt);
    }

    private string CreateAccessToken(IdentityUserInfo user, DateTime expiresAt)
    {
        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtOptions.SigningKey));
        var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.UserId),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        claims.AddRange(user.Roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var token = new JwtSecurityToken(
            issuer: _jwtOptions.Issuer,
            audience: _jwtOptions.Audience,
            claims: claims,
            notBefore: _dateTime.UtcNow,
            expires: expiresAt,
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string GenerateRefreshToken()
    {
        var randomBytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToBase64String(randomBytes);
    }

    private static string HashToken(string token)
    {
        var hashBytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToBase64String(hashBytes);
    }
}
