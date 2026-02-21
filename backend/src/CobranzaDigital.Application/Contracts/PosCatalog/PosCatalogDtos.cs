using CobranzaDigital.Domain.Entities;

namespace CobranzaDigital.Application.Contracts.PosCatalog;

public sealed record CategoryDto(Guid Id, string Name, int SortOrder, bool IsActive);
public sealed record UpsertCategoryRequest(string Name, int SortOrder, bool IsActive = true);

public sealed record ProductDto(Guid Id, string? ExternalCode, string Name, Guid CategoryId, string? SubcategoryName, decimal BasePrice, bool IsActive, bool IsAvailable, Guid? CustomizationSchemaId);
public sealed record UpsertProductRequest(string? ExternalCode, string Name, Guid CategoryId, string? SubcategoryName, decimal BasePrice, bool IsActive = true, bool IsAvailable = true, Guid? CustomizationSchemaId = null);

public sealed record OptionSetDto(Guid Id, string Name, bool IsActive);
public sealed record UpsertOptionSetRequest(string Name, bool IsActive = true);
public sealed record OptionItemDto(Guid Id, Guid OptionSetId, string Name, bool IsActive, bool IsAvailable, int SortOrder);
public sealed record UpsertOptionItemRequest(string Name, bool IsActive = true, bool IsAvailable = true, int SortOrder = 0);

public sealed record SchemaDto(Guid Id, string Name, bool IsActive);
public sealed record UpsertSchemaRequest(string Name, bool IsActive = true);

public sealed record SelectionGroupDto(Guid Id, Guid SchemaId, string Key, string Label, SelectionMode SelectionMode, int MinSelections, int MaxSelections, Guid OptionSetId, bool IsActive, int SortOrder);
public sealed record UpsertSelectionGroupRequest(string Key, string Label, SelectionMode SelectionMode, int MinSelections, int MaxSelections, Guid OptionSetId, bool IsActive = true, int SortOrder = 0);

public sealed record ExtraDto(Guid Id, string Name, decimal Price, bool IsActive, bool IsAvailable);
public sealed record UpsertExtraRequest(string Name, decimal Price, bool IsActive = true, bool IsAvailable = true);

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

public sealed record StoreInventoryItemDto(Guid StoreId, Guid ProductId, string ProductName, string? ProductSku, decimal OnHand, decimal Reserved, DateTimeOffset UpdatedAtUtc);
public sealed record UpsertStoreInventoryRequest(Guid StoreId, Guid ProductId, decimal OnHand);
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
