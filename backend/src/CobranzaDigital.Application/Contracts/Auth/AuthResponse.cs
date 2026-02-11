using System.Text.Json.Serialization;

namespace CobranzaDigital.Application.Contracts.Auth;

public sealed record AuthResponse(
    [property: JsonPropertyName("accessToken")] string AccessToken,
    [property: JsonPropertyName("refreshToken")] string RefreshToken,
    [property: JsonPropertyName("accessTokenExpiresAt")] DateTime AccessTokenExpiresAt,
    [property: JsonPropertyName("tokenType")] string TokenType = "Bearer");
