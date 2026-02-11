namespace CobranzaDigital.Application.Auditing;

public sealed record AuditEntry(
    string Action,
    Guid? UserId,
    string? CorrelationId,
    string? EntityType,
    string? EntityId,
    object? Before,
    object? After,
    string? Source,
    string? Notes,
    DateTime? OccurredAtUtc = null,
    string? Actor = null,
    string? Metadata = null);
