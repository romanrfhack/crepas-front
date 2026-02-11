namespace CobranzaDigital.Domain.Entities;

public sealed class RefreshToken
{
    public Guid Id { get; init; }

    public Guid UserId { get; init; }

    public string TokenHash { get; init; } = string.Empty;

    public DateTime ExpiresAt { get; init; }

    public DateTime CreatedAt { get; init; }

    public DateTime? RevokedAt { get; set; }

    public string? ReplacedByTokenHash { get; set; }
}
