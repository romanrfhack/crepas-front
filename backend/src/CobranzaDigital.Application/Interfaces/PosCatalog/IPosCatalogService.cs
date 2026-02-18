using CobranzaDigital.Application.Contracts.PosCatalog;

namespace CobranzaDigital.Application.Interfaces.PosCatalog;

public interface IPosCatalogService
{
    Task<IReadOnlyList<CategoryDto>> GetCategoriesAsync(bool includeInactive, CancellationToken ct);
    Task<CategoryDto> CreateCategoryAsync(UpsertCategoryRequest request, CancellationToken ct);
    Task<CategoryDto> UpdateCategoryAsync(Guid id, UpsertCategoryRequest request, CancellationToken ct);
    Task DeactivateCategoryAsync(Guid id, CancellationToken ct);

    Task<IReadOnlyList<ProductDto>> GetProductsAsync(bool includeInactive, Guid? categoryId, CancellationToken ct);
    Task<ProductDto> CreateProductAsync(UpsertProductRequest request, CancellationToken ct);
    Task<ProductDto> UpdateProductAsync(Guid id, UpsertProductRequest request, CancellationToken ct);
    Task DeactivateProductAsync(Guid id, CancellationToken ct);

    Task<IReadOnlyList<OptionSetDto>> GetOptionSetsAsync(bool includeInactive, CancellationToken ct);
    Task<OptionSetDto> CreateOptionSetAsync(UpsertOptionSetRequest request, CancellationToken ct);
    Task<OptionSetDto> UpdateOptionSetAsync(Guid id, UpsertOptionSetRequest request, CancellationToken ct);
    Task DeactivateOptionSetAsync(Guid id, CancellationToken ct);

    Task<IReadOnlyList<OptionItemDto>> GetOptionItemsAsync(Guid optionSetId, bool includeInactive, CancellationToken ct);
    Task<OptionItemDto> CreateOptionItemAsync(Guid optionSetId, UpsertOptionItemRequest request, CancellationToken ct);
    Task<OptionItemDto> UpdateOptionItemAsync(Guid optionSetId, Guid itemId, UpsertOptionItemRequest request, CancellationToken ct);
    Task DeactivateOptionItemAsync(Guid optionSetId, Guid itemId, CancellationToken ct);

    Task<IReadOnlyList<SchemaDto>> GetSchemasAsync(bool includeInactive, CancellationToken ct);
    Task<SchemaDto> CreateSchemaAsync(UpsertSchemaRequest request, CancellationToken ct);
    Task<SchemaDto> UpdateSchemaAsync(Guid id, UpsertSchemaRequest request, CancellationToken ct);
    Task DeactivateSchemaAsync(Guid id, CancellationToken ct);

    Task<IReadOnlyList<SelectionGroupDto>> GetGroupsAsync(Guid schemaId, bool includeInactive, CancellationToken ct);
    Task<SelectionGroupDto> CreateGroupAsync(Guid schemaId, UpsertSelectionGroupRequest request, CancellationToken ct);
    Task<SelectionGroupDto> UpdateGroupAsync(Guid schemaId, Guid groupId, UpsertSelectionGroupRequest request, CancellationToken ct);
    Task DeactivateGroupAsync(Guid schemaId, Guid groupId, CancellationToken ct);

    Task<IReadOnlyList<ExtraDto>> GetExtrasAsync(bool includeInactive, CancellationToken ct);
    Task<ExtraDto> CreateExtraAsync(UpsertExtraRequest request, CancellationToken ct);
    Task<ExtraDto> UpdateExtraAsync(Guid id, UpsertExtraRequest request, CancellationToken ct);
    Task DeactivateExtraAsync(Guid id, CancellationToken ct);

    Task<IReadOnlyList<IncludedItemDto>> GetIncludedItemsAsync(Guid productId, CancellationToken ct);
    Task<IReadOnlyList<IncludedItemDto>> ReplaceIncludedItemsAsync(Guid productId, ReplaceIncludedItemsRequest request, CancellationToken ct);

    Task<ProductOverrideDto> UpsertOverrideAsync(Guid productId, string groupKey, OverrideUpsertRequest request, CancellationToken ct);
    Task<CatalogSnapshotDto> GetSnapshotAsync(Guid? storeId, CancellationToken ct);
    Task<string> ComputeCatalogEtagAsync(CancellationToken ct);
}
