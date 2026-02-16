namespace CobranzaDigital.Application.Interfaces.PosSales;

public interface IPointsReversalService
{
    Task ReversePointsForSaleAsync(Guid saleId, int points, Guid userId, DateTimeOffset occurredAtUtc, CancellationToken ct);
}
