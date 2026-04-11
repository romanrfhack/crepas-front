using Asp.Versioning;

using CobranzaDigital.Application.Contracts.Auth;
using CobranzaDigital.Application.Interfaces;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CobranzaDigital.Api.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly IIdentityService _identityService;
    private readonly ITokenService _tokenService;

    public AuthController(IIdentityService identityService, ITokenService tokenService)
    {
        _identityService = identityService;
        _tokenService = tokenService;
    }

    [HttpPost("register")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public IActionResult Register(RegisterRequest request)
    {
        _ = request;
        return Problem(
            title: "Public registration is disabled",
            detail: "Use controlled onboarding to create users.",
            statusCode: StatusCodes.Status403Forbidden);
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        var user = await _identityService.ValidateUserAsync(request.Email, request.Password).ConfigureAwait(false);
        if (user is null)
        {
            return Problem(
                title: "Invalid credentials",
                detail: "The email or password is incorrect.",
                statusCode: StatusCodes.Status401Unauthorized);
        }

        var tokens = await _tokenService.CreateTokensAsync(user, cancellationToken).ConfigureAwait(false);
        return Ok(tokens);
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Refresh(RefreshTokenRequest request, CancellationToken cancellationToken)
    {
        var tokens = await _tokenService.RefreshTokensAsync(request.RefreshToken, cancellationToken).ConfigureAwait(false);
        if (tokens is null)
        {
            return Problem(
                title: "Invalid refresh token",
                detail: "The refresh token is invalid or expired.",
                statusCode: StatusCodes.Status401Unauthorized);
        }

        return Ok(tokens);
    }
}
