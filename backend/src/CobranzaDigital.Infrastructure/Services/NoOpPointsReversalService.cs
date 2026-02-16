using CobranzaDigital.Application.Interfaces.PosSales;

using Microsoft.Extensions.Logging;

namespace CobranzaDigital.Infrastructure.Services;

public sealed class NoOpPointsReversalService : IPointsReversalService
{
    private readonly ILogger<NoOpPointsReversalService> _logger;

    public NoOpPointsReversalService(ILogger<NoOpPointsReversalService> logger)
    {
        _logger = logger;
    }

    public Task ReversePointsForSaleAsync(Guid saleId, int points, Guid userId, DateTimeOffset occurredAtUtc, CancellationToken ct)
    {
        _logger.LogInformation(
            "TODO Release 6: reverse loyalty points for sale {SaleId}. Points={Points}, User={UserId}, OccurredAtUtc={OccurredAtUtc}",
            saleId,
            points,
            userId,
            occurredAtUtc);

        return Task.CompletedTask;
    }
}
