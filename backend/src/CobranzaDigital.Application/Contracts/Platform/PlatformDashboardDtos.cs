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
