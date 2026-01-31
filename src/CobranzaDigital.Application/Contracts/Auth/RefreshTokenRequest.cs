using System.ComponentModel.DataAnnotations;

namespace CobranzaDigital.Application.Contracts.Auth;

public sealed class RefreshTokenRequest
{
    [Required]
    public string RefreshToken { get; init; } = string.Empty;
}
