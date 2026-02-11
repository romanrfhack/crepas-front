namespace CobranzaDigital.Domain.Entities;

public sealed class AuditLog
{
    public Guid Id { get; set; }
    public string Action { get; set; } = string.Empty;
    public string Actor { get; set; } = string.Empty;
    public DateTimeOffset OccurredAt { get; set; }
    public string? Metadata { get; set; }

    public DateTime? OccurredAtUtc { get; set; }
    public Guid? UserId { get; set; }
    public string? EntityType { get; set; }
    public string? EntityId { get; set; }
    public string? BeforeJson { get; set; }
    public string? AfterJson { get; set; }
    public string? CorrelationId { get; set; }
    public string? Source { get; set; }
    public string? Notes { get; set; }
}
