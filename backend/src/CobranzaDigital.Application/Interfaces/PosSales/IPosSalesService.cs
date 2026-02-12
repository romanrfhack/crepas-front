using CobranzaDigital.Application.Contracts.PosSales;

namespace CobranzaDigital.Application.Interfaces.PosSales;

public interface IPosSalesService
{
    Task<CreateSaleResponseDto> CreateSaleAsync(CreateSaleRequestDto request, CancellationToken ct);
    Task<DailySummaryDto> GetDailySummaryAsync(DateOnly date, CancellationToken ct);
    Task<IReadOnlyList<TopProductDto>> GetTopProductsAsync(DateOnly dateFrom, DateOnly dateTo, int top, CancellationToken ct);
}
