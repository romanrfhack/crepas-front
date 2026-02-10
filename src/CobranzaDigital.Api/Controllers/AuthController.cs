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
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Register(RegisterRequest request, CancellationToken cancellationToken)
    {
        var result = await _identityService.CreateUserAsync(request.Email, request.Password);
        if (!result.Success)
        {
            return Problem(
                title: "Registration failed",
                detail: "Unable to register user.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var user = await _identityService.GetUserByIdAsync(result.UserId);
        if (user is null)
        {
            return Problem(
                title: "Registration failed",
                detail: "Unable to create session.",
                statusCode: StatusCodes.Status500InternalServerError);
        }

        var tokens = await _tokenService.CreateTokensAsync(user, cancellationToken);
        return Ok(tokens);
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        var user = await _identityService.ValidateUserAsync(request.Email, request.Password);
        if (user is null)
        {
            return Problem(
                title: "Invalid credentials",
                detail: "The email or password is incorrect.",
                statusCode: StatusCodes.Status401Unauthorized);
        }

        var tokens = await _tokenService.CreateTokensAsync(user, cancellationToken);
        return Ok(tokens);
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Refresh(RefreshTokenRequest request, CancellationToken cancellationToken)
    {
        var tokens = await _tokenService.RefreshTokensAsync(request.RefreshToken, cancellationToken);
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
