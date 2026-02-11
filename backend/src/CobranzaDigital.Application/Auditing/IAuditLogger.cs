namespace CobranzaDigital.Application.Auditing;

public interface IAuditLogger
{
    Task LogAsync(AuditEntry entry, CancellationToken ct = default);
}
