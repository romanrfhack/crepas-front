using System.Text.Json;
using Microsoft.Extensions.Logging;
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

    private static readonly Action<ILogger, string?, string, string?, string?, Exception> _logAuditWriteFailed =
        LoggerMessage.Define<string?, string, string?, string?>(
            LogLevel.Warning,
            new EventId(1, nameof(LogAuditWriteFailed)),
            "audit_log_write_failed correlationId={CorrelationId} action={Action} entity={EntityType} entityId={EntityId}");

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
            LogAuditWriteFailed(_logger, entry.CorrelationId, entry.Action, entry.EntityType, entry.EntityId, ex);
        }
    }

    private static void LogAuditWriteFailed(
        ILogger logger,
        string? correlationId,
        string action,
        string? entityType,
        string? entityId,
        Exception exception)
    {
        _logAuditWriteFailed(logger, correlationId, action, entityType, entityId, exception);
    }

    private static string? Serialize(object? data)
    {
        return data is null
            ? null
            : JsonSerializer.Serialize(data, JsonOptions);
    }
}