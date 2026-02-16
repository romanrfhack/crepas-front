using CobranzaDigital.Application.Interfaces.PosSales;

using Microsoft.Extensions.Logging;

namespace CobranzaDigital.Infrastructure.Services;

public sealed class NoOpPointsReversalService : IPointsReversalService
{
    private readonly ILogger<NoOpPointsReversalService> _logger;

    private static readonly Action<ILogger, Guid, int, Guid, DateTimeOffset, Exception?> _logReversePoints =
        LoggerMessage.Define<Guid, int, Guid, DateTimeOffset>(
            LogLevel.Information,
            new EventId(1, nameof(ReversePointsForSaleAsync)),
            "TODO Release 6: reverse loyalty points for sale {SaleId}. Points={Points}, User={UserId}, OccurredAtUtc={OccurredAtUtc}");

    public NoOpPointsReversalService(ILogger<NoOpPointsReversalService> logger)
    {
        _logger = logger;
    }

    public Task ReversePointsForSaleAsync(Guid saleId, int points, Guid userId, DateTimeOffset occurredAtUtc, CancellationToken ct)
    {
        _logReversePoints(_logger, saleId, points, userId, occurredAtUtc, null);

        return Task.CompletedTask;
    }
}
