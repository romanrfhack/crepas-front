using System.Text.Json;
using CobranzaDigital.Application.Auditing;
using CobranzaDigital.Domain.Entities;
using CobranzaDigital.Infrastructure.Persistence;

namespace CobranzaDigital.Infrastructure.Auditing;

public sealed class AuditLogger : IAuditLogger
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly CobranzaDigitalDbContext _dbContext;
    private readonly ILogger<AuditLogger> _logger;

    public AuditLogger(CobranzaDigitalDbContext dbContext, ILogger<AuditLogger> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task LogAsync(AuditEntry entry, CancellationToken ct = default)
    {
        try
        {
            var auditLog = new AuditLog
            {
                Id = Guid.NewGuid(),
                Action = entry.Action,
                Actor = entry.Actor ?? entry.UserId?.ToString() ?? "system",
                Metadata = entry.Metadata,
                OccurredAt = DateTimeOffset.UtcNow,
                OccurredAtUtc = entry.OccurredAtUtc ?? DateTime.UtcNow,
                UserId = entry.UserId,
                EntityType = entry.EntityType,
                EntityId = entry.EntityId,
                BeforeJson = Serialize(entry.Before),
                AfterJson = Serialize(entry.After),
                CorrelationId = entry.CorrelationId,
                Source = entry.Source,
                Notes = entry.Notes
            };

            _dbContext.AuditLogs.Add(auditLog);
            await _dbContext.SaveChangesAsync(ct).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "audit_log_write_failed correlationId={CorrelationId} action={Action} entity={EntityType} entityId={EntityId}",
                entry.CorrelationId,
                entry.Action,
                entry.EntityType,
                entry.EntityId);
        }
    }

    private static string? Serialize(object? data)
    {
        return data is null
            ? null
            : JsonSerializer.Serialize(data, JsonOptions);
    }
}
