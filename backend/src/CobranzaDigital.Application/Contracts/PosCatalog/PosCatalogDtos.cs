using CobranzaDigital.Domain.Entities;

namespace CobranzaDigital.Application.Contracts.PosCatalog;

public sealed record CategoryDto(Guid Id, string Name, int SortOrder, bool IsActive);
public sealed record UpsertCategoryRequest(string Name, int SortOrder, bool IsActive = true);

public sealed record ProductDto(Guid Id, string? ExternalCode, string Name, Guid CategoryId, string? SubcategoryName, decimal BasePrice, bool IsActive, Guid? CustomizationSchemaId);
public sealed record UpsertProductRequest(string? ExternalCode, string Name, Guid CategoryId, string? SubcategoryName, decimal BasePrice, bool IsActive = true, Guid? CustomizationSchemaId = null);

public sealed record OptionSetDto(Guid Id, string Name, bool IsActive);
public sealed record UpsertOptionSetRequest(string Name, bool IsActive = true);
public sealed record OptionItemDto(Guid Id, Guid OptionSetId, string Name, bool IsActive, int SortOrder);
public sealed record UpsertOptionItemRequest(string Name, bool IsActive, int SortOrder);

public sealed record SchemaDto(Guid Id, string Name, bool IsActive);
public sealed record UpsertSchemaRequest(string Name, bool IsActive = true);

public sealed record SelectionGroupDto(Guid Id, Guid SchemaId, string Key, string Label, SelectionMode SelectionMode, int MinSelections, int MaxSelections, Guid OptionSetId, bool IsActive, int SortOrder);
public sealed record UpsertSelectionGroupRequest(string Key, string Label, SelectionMode SelectionMode, int MinSelections, int MaxSelections, Guid OptionSetId, bool IsActive = true, int SortOrder = 0);

public sealed record ExtraDto(Guid Id, string Name, decimal Price, bool IsActive);
public sealed record UpsertExtraRequest(string Name, decimal Price, bool IsActive = true);

public sealed record IncludedItemDto(Guid Id, Guid ProductId, Guid ExtraId, int Quantity);
public sealed record ReplaceIncludedItemsRequest(IReadOnlyList<ReplaceIncludedItemRow> Items);
public sealed record ReplaceIncludedItemRow(Guid ExtraId, int Quantity);

public sealed record OverrideUpsertRequest(IReadOnlyList<Guid> AllowedOptionItemIds);
public sealed record ProductOverrideDto(Guid Id, Guid ProductId, string GroupKey, bool IsActive, IReadOnlyList<Guid> AllowedOptionItemIds);

public sealed record CatalogSnapshotDto(
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
