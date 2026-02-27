using CobranzaDigital.Application.Contracts.Platform;

namespace CobranzaDigital.Application.Interfaces.Platform;

public interface IPlatformDashboardService
{
    Task<PlatformDashboardSummaryDto> GetSummaryAsync(DateTimeOffset? dateFrom, DateTimeOffset? dateTo, decimal threshold, CancellationToken ct);
    Task<PlatformTopTenantsResponseDto> GetTopTenantsAsync(DateTimeOffset? dateFrom, DateTimeOffset? dateTo, int top, bool includeInactive, CancellationToken ct);
    Task<PlatformDashboardAlertsResponseDto> GetAlertsAsync(CancellationToken ct);
    Task<PlatformDashboardAlertDrilldownResponseDto> GetAlertsDrilldownAsync(string code, int take, Guid? tenantId, Guid? storeId, CancellationToken ct);
    Task<PlatformTenantOverviewDto> GetTenantOverviewAsync(Guid tenantId, DateTimeOffset? dateFrom, DateTimeOffset? dateTo, decimal threshold, CancellationToken ct);
    Task<PlatformStoreStockoutDetailDto> GetStoreStockoutDetailsAsync(Guid storeId, string? itemType, string? search, decimal threshold, string? mode, int take, CancellationToken ct);
    Task<PlatformRecentInventoryAdjustmentsResponseDto> GetRecentInventoryAdjustmentsAsync(int take, string? reason, Guid? tenantId, Guid? storeId, CancellationToken ct);
    Task<PlatformOutOfStockResponseDto> GetOutOfStockAsync(Guid? tenantId, Guid? storeId, string? itemType, string? search, bool onlyTracked, int top, CancellationToken ct);
    Task<PlatformSalesTrendResponseDto> GetSalesTrendAsync(DateTimeOffset? dateFrom, DateTimeOffset? dateTo, string? granularity, CancellationToken ct);
    Task<PlatformTopVoidTenantsResponseDto> GetTopVoidTenantsAsync(DateTimeOffset? dateFrom, DateTimeOffset? dateTo, int top, CancellationToken ct);
    Task<PlatformStockoutHotspotsResponseDto> GetStockoutHotspotsAsync(decimal threshold, int top, string? itemType, CancellationToken ct);
    Task<PlatformActivityFeedResponseDto> GetActivityFeedAsync(int take, string? eventType, CancellationToken ct);
    Task<PlatformExecutiveSignalsDto> GetExecutiveSignalsAsync(DateTimeOffset? dateFrom, DateTimeOffset? dateTo, bool previousPeriodCompare, CancellationToken ct);
}
