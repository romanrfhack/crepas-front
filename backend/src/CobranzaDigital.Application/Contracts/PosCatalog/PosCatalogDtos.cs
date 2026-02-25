using CobranzaDigital.Domain.Entities;

namespace CobranzaDigital.Application.Contracts.PosCatalog;

public sealed record CategoryDto(Guid Id, string Name, int SortOrder, bool IsActive);
public sealed record UpsertCategoryRequest(string Name, int SortOrder, bool IsActive = true);

public sealed record ProductDto(Guid Id, string? ExternalCode, string Name, Guid CategoryId, string? SubcategoryName, decimal BasePrice, bool IsActive, bool IsAvailable, Guid? CustomizationSchemaId, bool? IsInventoryTracked = null, decimal? StockOnHandQty = null, string? AvailabilityReason = null, string? StoreOverrideState = null);
public sealed record UpsertProductRequest(string? ExternalCode, string Name, Guid CategoryId, string? SubcategoryName, decimal BasePrice, bool IsActive = true, bool IsAvailable = true, Guid? CustomizationSchemaId = null, bool IsInventoryTracked = false);

public sealed record OptionSetDto(Guid Id, string Name, bool IsActive);
public sealed record UpsertOptionSetRequest(string Name, bool IsActive = true);
public sealed record OptionItemDto(Guid Id, Guid OptionSetId, string Name, bool IsActive, bool IsAvailable, int SortOrder, string? AvailabilityReason = null, string? StoreOverrideState = null);
public sealed record UpsertOptionItemRequest(string Name, bool IsActive = true, bool IsAvailable = true, int SortOrder = 0);

public sealed record SchemaDto(Guid Id, string Name, bool IsActive);
public sealed record UpsertSchemaRequest(string Name, bool IsActive = true);

public sealed record SelectionGroupDto(Guid Id, Guid SchemaId, string Key, string Label, SelectionMode SelectionMode, int MinSelections, int MaxSelections, Guid OptionSetId, bool IsActive, int SortOrder);
public sealed record UpsertSelectionGroupRequest(string Key, string Label, SelectionMode SelectionMode, int MinSelections, int MaxSelections, Guid OptionSetId, bool IsActive = true, int SortOrder = 0);

public sealed record ExtraDto(Guid Id, string Name, decimal Price, bool IsActive, bool IsAvailable, bool? IsInventoryTracked = null, decimal? StockOnHandQty = null, string? AvailabilityReason = null, string? StoreOverrideState = null);
public sealed record UpsertExtraRequest(string Name, decimal Price, bool IsActive = true, bool IsAvailable = true, bool IsInventoryTracked = false);

public sealed record IncludedItemDto(Guid Id, Guid ProductId, Guid ExtraId, int Quantity);
public sealed record ReplaceIncludedItemsRequest(IReadOnlyList<ReplaceIncludedItemRow> Items);
public sealed record ReplaceIncludedItemRow(Guid ExtraId, int Quantity);

public sealed record OverrideUpsertRequest(IReadOnlyList<Guid> AllowedOptionItemIds);
public sealed record ProductOverrideDto(Guid Id, Guid ProductId, string GroupKey, bool IsActive, IReadOnlyList<Guid> AllowedOptionItemIds);


public sealed record CatalogItemOverrideDto(
    string ItemType,
    Guid ItemId,
    bool IsEnabled,
    DateTimeOffset UpdatedAtUtc,
    string? ItemName = null,
    string? ItemSku = null,
    Guid? CatalogTemplateId = null);
public sealed record UpsertCatalogItemOverrideRequest(string ItemType, Guid ItemId, bool IsEnabled);

public sealed record CatalogStoreAvailabilityDto(
    Guid StoreId,
    string ItemType,
    Guid ItemId,
    bool IsAvailable,
    DateTimeOffset UpdatedAtUtc,
    string? ItemName = null,
    string? ItemSku = null);
public sealed record UpsertCatalogStoreAvailabilityRequest(Guid StoreId, string ItemType, Guid ItemId, bool IsAvailable);

public sealed record CatalogStoreOverrideDto(Guid StoreId, string ItemType, Guid ItemId, string State, DateTimeOffset UpdatedAtUtc, string? ItemName = null, string? ItemSku = null);
public sealed record UpsertCatalogStoreOverrideRequest(Guid StoreId, string ItemType, Guid ItemId, string State);

public sealed record StoreInventoryItemDto(Guid StoreId, Guid ProductId, string ProductName, string? ProductSku, decimal OnHand, decimal Reserved, DateTimeOffset? UpdatedAtUtc, bool HasInventoryRow);
public sealed record UpsertStoreInventoryRequest(Guid StoreId, Guid ProductId, decimal OnHand);

public sealed record CatalogInventoryItemDto(Guid StoreId, string ItemType, Guid ItemId, decimal OnHandQty, DateTimeOffset UpdatedAtUtc, string? ItemName = null, string? ItemSku = null, bool? IsInventoryTracked = null);
public sealed record UpsertCatalogInventoryRequest(Guid StoreId, string ItemType, Guid ItemId, decimal OnHandQty, string? Reason = null, string? Reference = null);
public sealed record CreateCatalogInventoryAdjustmentRequest(Guid StoreId, string ItemType, Guid ItemId, decimal QuantityDelta, string Reason, string? Reference = null, string? Note = null, string? ClientOperationId = null);
public sealed record CatalogInventoryAdjustmentDto(Guid Id, Guid StoreId, string ItemType, Guid ItemId, decimal QtyBefore, decimal QtyDelta, decimal QtyAfter, string Reason, string? Reference, string? Note, string? ClientOperationId, DateTimeOffset CreatedAtUtc, Guid? PerformedByUserId, string? ItemName = null, string? ItemSku = null);
public sealed record InventoryReportRowDto(string ItemType, Guid ItemId, string ItemName, string? ItemSku, Guid StoreId, decimal StockOnHandQty, bool IsInventoryTracked, string AvailabilityReason, string? StoreOverrideState, DateTimeOffset? UpdatedAtUtc, DateTimeOffset? LastAdjustmentAtUtc);
public sealed record PosInventorySettingsDto(bool ShowOnlyInStock);
public sealed record UpdatePosInventorySettingsRequest(bool ShowOnlyInStock);

public sealed record CatalogTemplateDto(Guid Id, Guid VerticalId, string Name, string? Version, bool IsActive, DateTimeOffset CreatedAtUtc, DateTimeOffset UpdatedAtUtc);
public sealed record UpsertCatalogTemplateRequest(Guid VerticalId, string Name, string? Version, bool IsActive = true);
public sealed record AssignTenantCatalogTemplateRequest(Guid CatalogTemplateId);

public sealed record CatalogSnapshotDto(
    Guid TenantId,
    Guid VerticalId,
    Guid CatalogTemplateId,
    Guid StoreId,
    string TimeZoneId,
    DateTimeOffset GeneratedAtUtc,
    string CatalogVersion,
    string EtagSeed,
    IReadOnlyList<CategoryDto> Categories,
    IReadOnlyList<ProductDto> Products,
    IReadOnlyList<OptionSetDto> OptionSets,
    IReadOnlyList<OptionItemDto> OptionItems,
    IReadOnlyList<SchemaDto> Schemas,
    IReadOnlyList<SelectionGroupDto> SelectionGroups,
    IReadOnlyList<ExtraDto> Extras,
    IReadOnlyList<IncludedItemDto> IncludedItems,
    IReadOnlyList<ProductOverrideDto> Overrides,
    string VersionStamp);
