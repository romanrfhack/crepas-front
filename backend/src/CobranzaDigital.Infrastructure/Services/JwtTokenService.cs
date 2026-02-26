using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

using CobranzaDigital.Application.Contracts.Auth;
using CobranzaDigital.Application.Interfaces;
using CobranzaDigital.Application.Options;
using CobranzaDigital.Domain.Entities;
using CobranzaDigital.Infrastructure.Identity;
using CobranzaDigital.Infrastructure.Persistence;

using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace CobranzaDigital.Infrastructure.Services;

public sealed class JwtTokenService : ITokenService
{
    private readonly CobranzaDigitalDbContext _dbContext;
    private readonly IDateTime _dateTime;
    private readonly IIdentityService _identityService;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly JwtOptions _jwtOptions;

    public JwtTokenService(
        CobranzaDigitalDbContext dbContext,
        IDateTime dateTime,
        IIdentityService identityService,
        UserManager<ApplicationUser> userManager,
        IOptions<JwtOptions> jwtOptions)
    {
        _dbContext = dbContext;
        _dateTime = dateTime;
        _identityService = identityService;
        _userManager = userManager;
        _jwtOptions = jwtOptions.Value;
    }

    public async Task<AuthResponse> CreateTokensAsync(
        IdentityUserInfo user,
        CancellationToken cancellationToken = default)
    {
        var now = _dateTime.UtcNow;
        var accessTokenExpiresAt = now.AddMinutes(_jwtOptions.AccessTokenMinutes);
        var accessToken = await CreateAccessTokenAsync(user, accessTokenExpiresAt, cancellationToken).ConfigureAwait(false);

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
        await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        return new AuthResponse(accessToken, refreshToken, accessTokenExpiresAt);
    }

    public async Task<AuthResponse?> RefreshTokensAsync(
        string refreshToken,
        CancellationToken cancellationToken = default)
    {
        var tokenHash = HashToken(refreshToken);
        var storedToken = await _dbContext.RefreshTokens
            .FirstOrDefaultAsync(token => token.TokenHash == tokenHash, cancellationToken).ConfigureAwait(false);

        if (storedToken is null || storedToken.RevokedAt is not null)
        {
            return null;
        }

        var now = _dateTime.UtcNow;
        if (storedToken.ExpiresAt <= now)
        {
            return null;
        }

        var user = await _identityService.GetUserByIdAsync(storedToken.UserId.ToString()).ConfigureAwait(false);
        if (user is null)
        {
            return null;
        }

        var accessTokenExpiresAt = now.AddMinutes(_jwtOptions.AccessTokenMinutes);
        var accessToken = await CreateAccessTokenAsync(user, accessTokenExpiresAt, cancellationToken).ConfigureAwait(false);

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
        await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        return new AuthResponse(accessToken, newRefreshToken, accessTokenExpiresAt);
    }

    private async Task<string> CreateAccessTokenAsync(
        IdentityUserInfo user,
        DateTime expiresAt,
        CancellationToken cancellationToken)
    {
        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtOptions.SigningKey));
        var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);
        var roles = await ResolveRolesAsync(user, cancellationToken).ConfigureAwait(false);
        var (tenantId, storeId) = await ResolveScopeAsync(user).ConfigureAwait(false);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.UserId),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(ClaimTypes.NameIdentifier, user.UserId),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));
        if (roles.Any(role => string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase) || string.Equals(role, "AdminStore", StringComparison.OrdinalIgnoreCase)))
        {
            claims.Add(new Claim("scope", "cobranza.read"));
        }

        if (tenantId.HasValue)
        {
            claims.Add(new Claim("tenantId", tenantId.Value.ToString("D")));
        }

        if (storeId.HasValue)
        {
            claims.Add(new Claim("storeId", storeId.Value.ToString("D")));
        }

        var token = new JwtSecurityToken(
            issuer: _jwtOptions.Issuer,
            audience: _jwtOptions.Audience,
            claims: claims,
            notBefore: _dateTime.UtcNow,
            expires: expiresAt,
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private async Task<IReadOnlyCollection<string>> ResolveRolesAsync(
        IdentityUserInfo user,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (!Guid.TryParse(user.UserId, out var parsedUserId))
        {
            return user.Roles;
        }

        var applicationUser = await _userManager.FindByIdAsync(parsedUserId.ToString()).ConfigureAwait(false);
        if (applicationUser is null)
        {
            return user.Roles;
        }

        var roles = await _userManager.GetRolesAsync(applicationUser).ConfigureAwait(false);
        return (IReadOnlyCollection<string>)roles;
    }


    private async Task<(Guid? TenantId, Guid? StoreId)> ResolveScopeAsync(IdentityUserInfo user)
    {
        if (!Guid.TryParse(user.UserId, out var parsedUserId))
        {
            return (null, null);
        }

        var applicationUser = await _userManager.FindByIdAsync(parsedUserId.ToString()).ConfigureAwait(false);
        return (applicationUser?.TenantId, applicationUser?.StoreId);
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
