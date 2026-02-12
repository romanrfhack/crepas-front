using Asp.Versioning;

using CobranzaDigital.Application.Contracts.PosCatalog;
using CobranzaDigital.Application.Interfaces.PosCatalog;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CobranzaDigital.Api.Controllers.Pos;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/pos/admin")]
[Authorize(Policy = AuthorizationPolicies.PosAdmin)]
public sealed class PosAdminCatalogController : ControllerBase
{
    private readonly IPosCatalogService _service;
    public PosAdminCatalogController(IPosCatalogService service) => _service = service;

    [HttpGet("categories")]
    public Task<IReadOnlyList<CategoryDto>> GetCategories([FromQuery] bool includeInactive = false, CancellationToken ct = default) => _service.GetCategoriesAsync(includeInactive, ct);
    [HttpPost("categories")]
    public Task<CategoryDto> CreateCategory([FromBody] UpsertCategoryRequest request, CancellationToken ct) => _service.CreateCategoryAsync(request, ct);
    [HttpPut("categories/{id:guid}")]
    public Task<CategoryDto> UpdateCategory(Guid id, [FromBody] UpsertCategoryRequest request, CancellationToken ct) => _service.UpdateCategoryAsync(id, request, ct);
    [HttpDelete("categories/{id:guid}")]
    public async Task<IActionResult> DeleteCategory(Guid id, CancellationToken ct) { await _service.DeactivateCategoryAsync(id, ct); return NoContent(); }

    [HttpGet("products")]
    public Task<IReadOnlyList<ProductDto>> GetProducts([FromQuery] bool includeInactive = false, [FromQuery] Guid? categoryId = null, CancellationToken ct = default) => _service.GetProductsAsync(includeInactive, categoryId, ct);
    [HttpPost("products")]
    public Task<ProductDto> CreateProduct([FromBody] UpsertProductRequest request, CancellationToken ct) => _service.CreateProductAsync(request, ct);
    [HttpPut("products/{id:guid}")]
    public Task<ProductDto> UpdateProduct(Guid id, [FromBody] UpsertProductRequest request, CancellationToken ct) => _service.UpdateProductAsync(id, request, ct);
    [HttpDelete("products/{id:guid}")]
    public async Task<IActionResult> DeleteProduct(Guid id, CancellationToken ct) { await _service.DeactivateProductAsync(id, ct); return NoContent(); }

    [HttpGet("option-sets")]
    public Task<IReadOnlyList<OptionSetDto>> GetOptionSets([FromQuery] bool includeInactive = false, CancellationToken ct = default) => _service.GetOptionSetsAsync(includeInactive, ct);
    [HttpPost("option-sets")]
    public Task<OptionSetDto> CreateOptionSet([FromBody] UpsertOptionSetRequest request, CancellationToken ct) => _service.CreateOptionSetAsync(request, ct);
    [HttpPut("option-sets/{id:guid}")]
    public Task<OptionSetDto> UpdateOptionSet(Guid id, [FromBody] UpsertOptionSetRequest request, CancellationToken ct) => _service.UpdateOptionSetAsync(id, request, ct);
    [HttpDelete("option-sets/{id:guid}")]
    public async Task<IActionResult> DeleteOptionSet(Guid id, CancellationToken ct) { await _service.DeactivateOptionSetAsync(id, ct); return NoContent(); }

    [HttpGet("option-sets/{optionSetId:guid}/items")]
    public Task<IReadOnlyList<OptionItemDto>> GetOptionItems(Guid optionSetId, [FromQuery] bool includeInactive = false, CancellationToken ct = default) => _service.GetOptionItemsAsync(optionSetId, includeInactive, ct);
    [HttpPost("option-sets/{optionSetId:guid}/items")]
    public Task<OptionItemDto> CreateOptionItem(Guid optionSetId, [FromBody] UpsertOptionItemRequest request, CancellationToken ct) => _service.CreateOptionItemAsync(optionSetId, request, ct);
    [HttpPut("option-sets/{optionSetId:guid}/items/{itemId:guid}")]
    public Task<OptionItemDto> UpdateOptionItem(Guid optionSetId, Guid itemId, [FromBody] UpsertOptionItemRequest request, CancellationToken ct) => _service.UpdateOptionItemAsync(optionSetId, itemId, request, ct);
    [HttpDelete("option-sets/{optionSetId:guid}/items/{itemId:guid}")]
    public async Task<IActionResult> DeleteOptionItem(Guid optionSetId, Guid itemId, CancellationToken ct) { await _service.DeactivateOptionItemAsync(optionSetId, itemId, ct); return NoContent(); }

    [HttpGet("schemas")]
    public Task<IReadOnlyList<SchemaDto>> GetSchemas([FromQuery] bool includeInactive = false, CancellationToken ct = default) => _service.GetSchemasAsync(includeInactive, ct);
    [HttpPost("schemas")]
    public Task<SchemaDto> CreateSchema([FromBody] UpsertSchemaRequest request, CancellationToken ct) => _service.CreateSchemaAsync(request, ct);
    [HttpPut("schemas/{id:guid}")]
    public Task<SchemaDto> UpdateSchema(Guid id, [FromBody] UpsertSchemaRequest request, CancellationToken ct) => _service.UpdateSchemaAsync(id, request, ct);
    [HttpDelete("schemas/{id:guid}")]
    public async Task<IActionResult> DeleteSchema(Guid id, CancellationToken ct) { await _service.DeactivateSchemaAsync(id, ct); return NoContent(); }

    [HttpGet("schemas/{schemaId:guid}/groups")]
    public Task<IReadOnlyList<SelectionGroupDto>> GetGroups(Guid schemaId, [FromQuery] bool includeInactive = false, CancellationToken ct = default) => _service.GetGroupsAsync(schemaId, includeInactive, ct);
    [HttpPost("schemas/{schemaId:guid}/groups")]
    public Task<SelectionGroupDto> CreateGroup(Guid schemaId, [FromBody] UpsertSelectionGroupRequest request, CancellationToken ct) => _service.CreateGroupAsync(schemaId, request, ct);
    [HttpPut("schemas/{schemaId:guid}/groups/{groupId:guid}")]
    public Task<SelectionGroupDto> UpdateGroup(Guid schemaId, Guid groupId, [FromBody] UpsertSelectionGroupRequest request, CancellationToken ct) => _service.UpdateGroupAsync(schemaId, groupId, request, ct);
    [HttpDelete("schemas/{schemaId:guid}/groups/{groupId:guid}")]
    public async Task<IActionResult> DeleteGroup(Guid schemaId, Guid groupId, CancellationToken ct) { await _service.DeactivateGroupAsync(schemaId, groupId, ct); return NoContent(); }

    [HttpGet("extras")]
    public Task<IReadOnlyList<ExtraDto>> GetExtras([FromQuery] bool includeInactive = false, CancellationToken ct = default) => _service.GetExtrasAsync(includeInactive, ct);
    [HttpPost("extras")]
    public Task<ExtraDto> CreateExtra([FromBody] UpsertExtraRequest request, CancellationToken ct) => _service.CreateExtraAsync(request, ct);
    [HttpPut("extras/{id:guid}")]
    public Task<ExtraDto> UpdateExtra(Guid id, [FromBody] UpsertExtraRequest request, CancellationToken ct) => _service.UpdateExtraAsync(id, request, ct);
    [HttpDelete("extras/{id:guid}")]
    public async Task<IActionResult> DeleteExtra(Guid id, CancellationToken ct) { await _service.DeactivateExtraAsync(id, ct); return NoContent(); }

    [HttpGet("products/{productId:guid}/included-items")]
    public Task<IReadOnlyList<IncludedItemDto>> GetIncludedItems(Guid productId, CancellationToken ct) => _service.GetIncludedItemsAsync(productId, ct);
    [HttpPut("products/{productId:guid}/included-items")]
    public Task<IReadOnlyList<IncludedItemDto>> ReplaceIncludedItems(Guid productId, [FromBody] ReplaceIncludedItemsRequest request, CancellationToken ct) => _service.ReplaceIncludedItemsAsync(productId, request, ct);

    [HttpPut("products/{productId:guid}/overrides/{groupKey}")]
    public Task<ProductOverrideDto> UpsertOverride(Guid productId, string groupKey, [FromBody] OverrideUpsertRequest request, CancellationToken ct) => _service.UpsertOverrideAsync(productId, groupKey, request, ct);
}
