namespace CobranzaDigital.Application.Contracts.Platform;

public sealed record PlatformDashboardSummaryDto(
    int ActiveTenants,
    int InactiveTenants,
    int ActiveStores,
    int InactiveStores,
    int TotalUsers,
    int UsersWithoutStoreAssignment,
    int TenantsWithoutCatalogTemplate,
    int StoresWithoutAdminStore,
    int SalesTodayCount,
    decimal SalesTodayAmount,
    int SalesLast7DaysCount,
    decimal SalesLast7DaysAmount,
    int OpenShiftsCount,
    int OutOfStockItemsCount,
    int LowStockItemsCount,
    DateTimeOffset EffectiveDateFromUtc,
    DateTimeOffset EffectiveDateToUtc,
    decimal EffectiveLowStockThreshold);

public sealed record PlatformTopTenantRowDto(
    Guid TenantId,
    string TenantName,
    Guid VerticalId,
    string? VerticalName,
    int StoreCount,
    int SalesCount,
    decimal SalesAmount,
    decimal AverageTicket,
    int VoidedSalesCount);

public sealed record PlatformTopTenantsResponseDto(
    IReadOnlyList<PlatformTopTenantRowDto> Items,
    DateTimeOffset EffectiveDateFromUtc,
    DateTimeOffset EffectiveDateToUtc,
    int Top,
    bool IncludeInactive);

public sealed record PlatformDashboardAlertDto(
    string Code,
    string Severity,
    int Count,
    string Description,
    IReadOnlyList<string> TopExamples);

public sealed record PlatformDashboardAlertsResponseDto(IReadOnlyList<PlatformDashboardAlertDto> Alerts);

public sealed record PlatformDashboardAlertDrilldownResponseDto(
    string Code,
    IReadOnlyList<PlatformDashboardAlertDrilldownItemDto> Items);

public sealed record PlatformDashboardAlertDrilldownItemDto(
    Guid? TenantId,
    string? TenantName,
    Guid? StoreId,
    string? StoreName,
    Guid? UserId,
    string? UserName,
    string? Email,
    string? Role,
    string Description,
    string? Reason,
    IDictionary<string, string?>? Metadata);

public sealed record PlatformTenantOverviewDto(
    Guid TenantId,
    string TenantName,
    Guid VerticalId,
    string? VerticalName,
    int StoreCount,
    int ActiveStoreCount,
    int TotalUsers,
    int UsersWithoutStoreAssignmentCount,
    int SalesInRangeCount,
    decimal SalesInRangeAmount,
    int VoidedSalesCount,
    int OutOfStockItemsCount,
    int LowStockItemsCount,
    DateTimeOffset? LastInventoryAdjustmentAtUtc,
    bool HasCatalogTemplate,
    int StoresWithoutAdminStoreCount,
    DateTimeOffset EffectiveDateFromUtc,
    DateTimeOffset EffectiveDateToUtc,
    decimal EffectiveThreshold);

public sealed record PlatformStoreStockoutDetailDto(
    Guid StoreId,
    string StoreName,
    Guid TenantId,
    string TenantName,
    string Mode,
    decimal EffectiveThreshold,
    IReadOnlyList<PlatformStoreStockoutDetailItemDto> Items);

public sealed record PlatformStoreStockoutDetailItemDto(
    string ItemType,
    Guid ItemId,
    string ItemName,
    string? ItemSku,
    decimal StockOnHandQty,
    bool IsInventoryTracked,
    string AvailabilityReason,
    DateTimeOffset? LastAdjustmentAtUtc);

public sealed record PlatformRecentInventoryAdjustmentDto(
    Guid AdjustmentId,
    Guid TenantId,
    string TenantName,
    Guid StoreId,
    string StoreName,
    string ItemType,
    Guid ItemId,
    string ItemName,
    string? ItemSku,
    decimal QtyBefore,
    decimal QtyDelta,
    decimal QtyAfter,
    string Reason,
    string? ReferenceType,
    Guid? ReferenceId,
    string? MovementKind,
    DateTimeOffset CreatedAtUtc,
    Guid? PerformedByUserId);

public sealed record PlatformRecentInventoryAdjustmentsResponseDto(IReadOnlyList<PlatformRecentInventoryAdjustmentDto> Items, int Take);

public sealed record PlatformOutOfStockRowDto(
    Guid TenantId,
    string TenantName,
    Guid StoreId,
    string StoreName,
    string ItemType,
    Guid ItemId,
    string ItemName,
    string? ItemSku,
    decimal StockOnHandQty,
    DateTimeOffset UpdatedAtUtc,
    DateTimeOffset? LastAdjustmentAtUtc);

public sealed record PlatformOutOfStockResponseDto(IReadOnlyList<PlatformOutOfStockRowDto> Items);

public sealed record PlatformSalesTrendPointDto(
    DateTimeOffset BucketStartUtc,
    string BucketLabel,
    int SalesCount,
    decimal SalesAmount,
    int VoidedSalesCount,
    decimal AverageTicket);

public sealed record PlatformSalesTrendResponseDto(
    IReadOnlyList<PlatformSalesTrendPointDto> Items,
    DateTimeOffset EffectiveDateFromUtc,
    DateTimeOffset EffectiveDateToUtc,
    string Granularity);

public sealed record PlatformTopVoidTenantRowDto(
    Guid TenantId,
    string TenantName,
    Guid VerticalId,
    string? VerticalName,
    int VoidedSalesCount,
    decimal VoidedSalesAmount,
    int TotalSalesCount,
    decimal VoidRate,
    int StoreCount);

public sealed record PlatformTopVoidTenantsResponseDto(
    IReadOnlyList<PlatformTopVoidTenantRowDto> Items,
    DateTimeOffset EffectiveDateFromUtc,
    DateTimeOffset EffectiveDateToUtc,
    int Top);

public sealed record PlatformStockoutHotspotRowDto(
    Guid TenantId,
    string TenantName,
    Guid StoreId,
    string StoreName,
    int OutOfStockItemsCount,
    int LowStockItemsCount,
    DateTimeOffset? LastInventoryMovementAtUtc,
    int TrackedItemsCount);

public sealed record PlatformStockoutHotspotsResponseDto(
    IReadOnlyList<PlatformStockoutHotspotRowDto> Items,
    decimal Threshold,
    int Top,
    string? ItemType);

public sealed record PlatformActivityFeedItemDto(
    string EventType,
    DateTimeOffset OccurredAtUtc,
    Guid TenantId,
    string TenantName,
    Guid StoreId,
    string StoreName,
    string Title,
    string Description,
    Guid? ReferenceId,
    string Severity,
    Guid? ActorUserId);

public sealed record PlatformActivityFeedResponseDto(IReadOnlyList<PlatformActivityFeedItemDto> Items, int Take, string? EventType);

public sealed record PlatformExecutiveSignalsDto(
    Guid? FastestGrowingTenantId,
    string? FastestGrowingTenantName,
    decimal? SalesGrowthRatePercent,
    decimal VoidRatePercent,
    int TenantsWithNoSalesInRangeCount,
    int StoresWithNoAdminStoreCount,
    int TenantsWithNoCatalogTemplateCount,
    int StoresWithOutOfStockCount,
    int InventoryAdjustmentCountInRange,
    Guid? TopRiskTenantId,
    string? TopRiskTenantName,
    DateTimeOffset EffectiveDateFromUtc,
    DateTimeOffset EffectiveDateToUtc,
    bool PreviousPeriodCompare);
