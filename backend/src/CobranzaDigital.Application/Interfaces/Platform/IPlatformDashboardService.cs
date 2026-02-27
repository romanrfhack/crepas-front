using CobranzaDigital.Application.Contracts.Platform;

namespace CobranzaDigital.Application.Interfaces.Platform;

public interface IPlatformDashboardService
{
    Task<PlatformDashboardSummaryDto> GetSummaryAsync(DateTimeOffset? dateFrom, DateTimeOffset? dateTo, decimal threshold, CancellationToken ct);
    Task<PlatformTopTenantsResponseDto> GetTopTenantsAsync(DateTimeOffset? dateFrom, DateTimeOffset? dateTo, int top, bool includeInactive, CancellationToken ct);
    Task<PlatformDashboardAlertsResponseDto> GetAlertsAsync(CancellationToken ct);
    Task<PlatformRecentInventoryAdjustmentsResponseDto> GetRecentInventoryAdjustmentsAsync(int take, string? reason, Guid? tenantId, Guid? storeId, CancellationToken ct);
    Task<PlatformOutOfStockResponseDto> GetOutOfStockAsync(Guid? tenantId, Guid? storeId, string? itemType, string? search, bool onlyTracked, int top, CancellationToken ct);
}
