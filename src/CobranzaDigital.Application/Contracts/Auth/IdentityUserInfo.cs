namespace CobranzaDigital.Application.Contracts.Auth;

public sealed record IdentityUserInfo(
    string UserId,
    string Email,
    IReadOnlyCollection<string> Roles);
