using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

using CobranzaDigital.Application.Auditing;
using CobranzaDigital.Application.Common.Exceptions;
using CobranzaDigital.Application.Contracts.PosCatalog;
using CobranzaDigital.Application.Interfaces;
using CobranzaDigital.Application.Interfaces.PosCatalog;
using CobranzaDigital.Application.Validators.PosCatalog;
using CobranzaDigital.Domain.Entities;
using CobranzaDigital.Infrastructure.Persistence;

using FluentValidation;

using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

using ValidationException = CobranzaDigital.Application.Common.Exceptions.ValidationException;

namespace CobranzaDigital.Infrastructure.Services;

public sealed class PosCatalogService : IPosCatalogService
{
    private readonly CobranzaDigitalDbContext _db;
    private readonly IAuditLogger _auditLogger;
    private readonly ILogger<PosCatalogService> _logger;
    private readonly IValidator<UpsertSelectionGroupRequest> _groupValidator;
    private readonly IValidator<UpsertProductRequest> _productValidator;
    private readonly IValidator<UpsertExtraRequest> _extraValidator;
    private readonly IValidator<ReplaceIncludedItemsRequest> _includedValidator;
    private readonly IValidator<OverrideUpsertRequest> _overrideValidator;
    private readonly PosStoreContextService _storeContext;
    private readonly ITenantContext _tenantContext;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public PosCatalogService(CobranzaDigitalDbContext db, IAuditLogger auditLogger, ILogger<PosCatalogService> logger,
        IValidator<UpsertSelectionGroupRequest> groupValidator,
        IValidator<UpsertProductRequest> productValidator,
        IValidator<UpsertExtraRequest> extraValidator,
        IValidator<ReplaceIncludedItemsRequest> includedValidator,
        IValidator<OverrideUpsertRequest> overrideValidator,
        PosStoreContextService storeContext,
        ITenantContext tenantContext,
        IHttpContextAccessor httpContextAccessor)
    { _db = db; _auditLogger = auditLogger; _logger = logger; _groupValidator = groupValidator; _productValidator = productValidator; _extraValidator = extraValidator; _includedValidator = includedValidator; _overrideValidator = overrideValidator; _storeContext = storeContext; _tenantContext = tenantContext; _httpContextAccessor = httpContextAccessor; }

    public async Task<IReadOnlyList<CategoryDto>> GetCategoriesAsync(bool includeInactive, CancellationToken ct)
    {
        var catalogTemplateId = await GetTenantCatalogTemplateIdAsync(ct).ConfigureAwait(false);

        return await _db.Categories
            .AsNoTracking()
            .Where(x => x.CatalogTemplateId == catalogTemplateId)
            .Where(x => includeInactive || x.IsActive)
            .OrderBy(x => x.SortOrder)
            .Select(x => new CategoryDto(x.Id, x.Name, x.SortOrder, x.IsActive))
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public async Task<CategoryDto> CreateCategoryAsync(UpsertCategoryRequest request, CancellationToken ct)
    {
        var catalogTemplateId = await GetTenantCatalogTemplateIdAsync(ct).ConfigureAwait(false);
        var e = new Category
        {
            Id = Guid.NewGuid(),
            CatalogTemplateId = catalogTemplateId,
            Name = request.Name,
            SortOrder = request.SortOrder,
            IsActive = request.IsActive
        };

        _db.Categories.Add(e);
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
        return new CategoryDto(e.Id, e.Name, e.SortOrder, e.IsActive);
    }
    public async Task<CategoryDto> UpdateCategoryAsync(Guid id, UpsertCategoryRequest request, CancellationToken ct) { var e = await FindAsync(_db.Categories, id, ct).ConfigureAwait(false); var before = new { e.Name, e.SortOrder, e.IsActive }; e.Name = request.Name; e.SortOrder = request.SortOrder; e.IsActive = request.IsActive; await _db.SaveChangesAsync(ct).ConfigureAwait(false); await AuditAsync("Category", "Update", id, before, new { e.Name, e.SortOrder, e.IsActive }, ct).ConfigureAwait(false); return new(e.Id, e.Name, e.SortOrder, e.IsActive); }
    public async Task DeactivateCategoryAsync(Guid id, CancellationToken ct) { var e = await FindAsync(_db.Categories, id, ct).ConfigureAwait(false); var before = new { e.IsActive }; e.IsActive = false; await _db.SaveChangesAsync(ct).ConfigureAwait(false); await AuditAsync("Category", "Deactivate", id, before, new { e.IsActive }, ct).ConfigureAwait(false); }

    public async Task<IReadOnlyList<ProductDto>> GetProductsAsync(bool includeInactive, Guid? categoryId, CancellationToken ct)
    {
        var catalogTemplateId = await GetTenantCatalogTemplateIdAsync(ct).ConfigureAwait(false);

        return await _db.Products
            .AsNoTracking()
            .Where(x => x.CatalogTemplateId == catalogTemplateId)
            .Where(x => includeInactive || x.IsActive)
            .Where(x => !categoryId.HasValue || x.CategoryId == categoryId.Value)
            .Select(x => Map(x))
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public async Task<ProductDto> CreateProductAsync(UpsertProductRequest request, CancellationToken ct)
    {
        await _productValidator.EnsureValidAsync(request, ct).ConfigureAwait(false);
        await EnsureSchemaActiveIfPresent(request.CustomizationSchemaId, ct).ConfigureAwait(false);

        var catalogTemplateId = await GetTenantCatalogTemplateIdAsync(ct).ConfigureAwait(false);
        var e = new Product
        {
            Id = Guid.NewGuid(),
            CatalogTemplateId = catalogTemplateId,
            ExternalCode = request.ExternalCode,
            Name = request.Name,
            CategoryId = request.CategoryId,
            SubcategoryName = request.SubcategoryName,
            BasePrice = request.BasePrice,
            IsActive = request.IsActive,
            IsAvailable = request.IsAvailable,
            CustomizationSchemaId = request.CustomizationSchemaId,
            IsInventoryTracked = request.IsInventoryTracked
        };

        _db.Products.Add(e);
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
        return Map(e);
    }
    public async Task<ProductDto> UpdateProductAsync(Guid id, UpsertProductRequest request, CancellationToken ct) { await _productValidator.EnsureValidAsync(request, ct).ConfigureAwait(false); await EnsureSchemaActiveIfPresent(request.CustomizationSchemaId, ct).ConfigureAwait(false); var e = await FindAsync(_db.Products, id, ct).ConfigureAwait(false); var before = Map(e); e.ExternalCode = request.ExternalCode; e.Name = request.Name; e.CategoryId = request.CategoryId; e.SubcategoryName = request.SubcategoryName; e.BasePrice = request.BasePrice; e.IsActive = request.IsActive; e.IsAvailable = request.IsAvailable; e.CustomizationSchemaId = request.CustomizationSchemaId; e.IsInventoryTracked = request.IsInventoryTracked; await _db.SaveChangesAsync(ct).ConfigureAwait(false); await AuditAsync("Product", before.IsAvailable != e.IsAvailable ? "UpdateProductAvailability" : "UpdateProduct", id, before, Map(e), ct).ConfigureAwait(false); return Map(e); }
    public async Task DeactivateProductAsync(Guid id, CancellationToken ct) { var e = await FindAsync(_db.Products, id, ct).ConfigureAwait(false); var before = new { e.IsActive }; e.IsActive = false; await _db.SaveChangesAsync(ct).ConfigureAwait(false); await AuditAsync("Product", "Deactivate", id, before, new { e.IsActive }, ct).ConfigureAwait(false); }

    public async Task<IReadOnlyList<OptionSetDto>> GetOptionSetsAsync(bool includeInactive, CancellationToken ct)
    {
        var catalogTemplateId = await GetTenantCatalogTemplateIdAsync(ct).ConfigureAwait(false);

        return await _db.OptionSets.AsNoTracking()
            .Where(x => x.CatalogTemplateId == catalogTemplateId)
            .Where(x => includeInactive || x.IsActive)
            .Select(x => new OptionSetDto(x.Id, x.Name, x.IsActive))
            .ToListAsync(ct).ConfigureAwait(false);
    }
    public async Task<OptionSetDto> CreateOptionSetAsync(UpsertOptionSetRequest request, CancellationToken ct)
    {
        var catalogTemplateId = await GetTenantCatalogTemplateIdAsync(ct).ConfigureAwait(false);
        var e = new OptionSet { Id = Guid.NewGuid(), CatalogTemplateId = catalogTemplateId, Name = request.Name, IsActive = request.IsActive };
        _db.OptionSets.Add(e);
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
        return new OptionSetDto(e.Id, e.Name, e.IsActive);
    }
    public async Task<OptionSetDto> UpdateOptionSetAsync(Guid id, UpsertOptionSetRequest request, CancellationToken ct) { var e = await FindAsync(_db.OptionSets, id, ct).ConfigureAwait(false); var before = new { e.Name, e.IsActive }; e.Name = request.Name; e.IsActive = request.IsActive; await _db.SaveChangesAsync(ct).ConfigureAwait(false); await AuditAsync("OptionSet", "Update", id, before, new { e.Name, e.IsActive }, ct).ConfigureAwait(false); return new(e.Id, e.Name, e.IsActive); }
    public async Task DeactivateOptionSetAsync(Guid id, CancellationToken ct) { var e = await FindAsync(_db.OptionSets, id, ct).ConfigureAwait(false); e.IsActive = false; await _db.SaveChangesAsync(ct).ConfigureAwait(false); }

    public async Task<IReadOnlyList<OptionItemDto>> GetOptionItemsAsync(Guid optionSetId, bool includeInactive, CancellationToken ct)
    {
        var catalogTemplateId = await GetTenantCatalogTemplateIdAsync(ct).ConfigureAwait(false);

        return await _db.OptionItems.AsNoTracking()
            .Where(x => x.CatalogTemplateId == catalogTemplateId && x.OptionSetId == optionSetId && (includeInactive || x.IsActive))
            .Select(x => new OptionItemDto(x.Id, x.OptionSetId, x.Name, x.IsActive, x.IsAvailable, x.SortOrder))
            .ToListAsync(ct).ConfigureAwait(false);
    }
    public async Task<OptionItemDto> CreateOptionItemAsync(Guid optionSetId, UpsertOptionItemRequest request, CancellationToken ct)
    {
        var catalogTemplateId = await GetTenantCatalogTemplateIdAsync(ct).ConfigureAwait(false);
        var e = new OptionItem { Id = Guid.NewGuid(), CatalogTemplateId = catalogTemplateId, OptionSetId = optionSetId, Name = request.Name, IsActive = request.IsActive, IsAvailable = request.IsAvailable, SortOrder = request.SortOrder };
        _db.OptionItems.Add(e);
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
        return new OptionItemDto(e.Id, e.OptionSetId, e.Name, e.IsActive, e.IsAvailable, e.SortOrder);
    }
    public async Task<OptionItemDto> UpdateOptionItemAsync(Guid optionSetId, Guid itemId, UpsertOptionItemRequest request, CancellationToken ct) { var e = await _db.OptionItems.SingleOrDefaultAsync(x => x.Id == itemId && x.OptionSetId == optionSetId, ct).ConfigureAwait(false) ?? throw new NotFoundException("Option item not found"); var wasAvailable = e.IsAvailable; e.Name = request.Name; e.IsActive = request.IsActive; e.IsAvailable = request.IsAvailable; e.SortOrder = request.SortOrder; await _db.SaveChangesAsync(ct).ConfigureAwait(false); if (wasAvailable != e.IsAvailable) await AuditAsync("OptionItem", "UpdateOptionItemAvailability", e.Id, new { IsAvailable = wasAvailable }, new { e.IsAvailable }, ct).ConfigureAwait(false); return new(e.Id, e.OptionSetId, e.Name, e.IsActive, e.IsAvailable, e.SortOrder); }
    public async Task DeactivateOptionItemAsync(Guid optionSetId, Guid itemId, CancellationToken ct) { var e = await _db.OptionItems.SingleOrDefaultAsync(x => x.Id == itemId && x.OptionSetId == optionSetId, ct).ConfigureAwait(false) ?? throw new NotFoundException("Option item not found"); e.IsActive = false; await _db.SaveChangesAsync(ct).ConfigureAwait(false); }

    public async Task<IReadOnlyList<SchemaDto>> GetSchemasAsync(bool includeInactive, CancellationToken ct)
    {
        var catalogTemplateId = await GetTenantCatalogTemplateIdAsync(ct).ConfigureAwait(false);

        return await _db.CustomizationSchemas.AsNoTracking()
            .Where(x => x.CatalogTemplateId == catalogTemplateId)
            .Where(x => includeInactive || x.IsActive)
            .Select(x => new SchemaDto(x.Id, x.Name, x.IsActive))
            .ToListAsync(ct).ConfigureAwait(false);
    }
    public async Task<SchemaDto> CreateSchemaAsync(UpsertSchemaRequest request, CancellationToken ct)
    {
        var catalogTemplateId = await GetTenantCatalogTemplateIdAsync(ct).ConfigureAwait(false);
        var e = new CustomizationSchema { Id = Guid.NewGuid(), CatalogTemplateId = catalogTemplateId, Name = request.Name, IsActive = request.IsActive };
        _db.CustomizationSchemas.Add(e);
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
        return new SchemaDto(e.Id, e.Name, e.IsActive);
    }
    public async Task<SchemaDto> UpdateSchemaAsync(Guid id, UpsertSchemaRequest request, CancellationToken ct) { var e = await FindAsync(_db.CustomizationSchemas, id, ct).ConfigureAwait(false); e.Name = request.Name; e.IsActive = request.IsActive; await _db.SaveChangesAsync(ct).ConfigureAwait(false); return new(e.Id, e.Name, e.IsActive); }
    public async Task DeactivateSchemaAsync(Guid id, CancellationToken ct) { var e = await FindAsync(_db.CustomizationSchemas, id, ct).ConfigureAwait(false); e.IsActive = false; await _db.SaveChangesAsync(ct).ConfigureAwait(false); }

    public async Task<IReadOnlyList<SelectionGroupDto>> GetGroupsAsync(Guid schemaId, bool includeInactive, CancellationToken ct)
    {
        var catalogTemplateId = await GetTenantCatalogTemplateIdAsync(ct).ConfigureAwait(false);

        return await _db.SelectionGroups.AsNoTracking()
            .Where(x => x.CatalogTemplateId == catalogTemplateId && x.SchemaId == schemaId && (includeInactive || x.IsActive))
            .Select(x => Map(x))
            .ToListAsync(ct).ConfigureAwait(false);
    }
    public async Task<SelectionGroupDto> CreateGroupAsync(Guid schemaId, UpsertSelectionGroupRequest request, CancellationToken ct)
    {
        await _groupValidator.EnsureValidAsync(request, ct).ConfigureAwait(false);
        await EnsureUniqueGroupKey(schemaId, request.Key, null, ct).ConfigureAwait(false);
        var catalogTemplateId = await GetTenantCatalogTemplateIdAsync(ct).ConfigureAwait(false);
        var e = new SelectionGroup { Id = Guid.NewGuid(), CatalogTemplateId = catalogTemplateId, SchemaId = schemaId, Key = request.Key, Label = request.Label, SelectionMode = request.SelectionMode, MinSelections = request.MinSelections, MaxSelections = request.MaxSelections, OptionSetId = request.OptionSetId, IsActive = request.IsActive, SortOrder = request.SortOrder };
        _db.SelectionGroups.Add(e);
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
        return Map(e);
    }
    public async Task<SelectionGroupDto> UpdateGroupAsync(Guid schemaId, Guid groupId, UpsertSelectionGroupRequest request, CancellationToken ct) { await _groupValidator.EnsureValidAsync(request, ct).ConfigureAwait(false); await EnsureUniqueGroupKey(schemaId, request.Key, groupId, ct).ConfigureAwait(false); var e = await _db.SelectionGroups.SingleOrDefaultAsync(x => x.Id == groupId && x.SchemaId == schemaId, ct).ConfigureAwait(false) ?? throw new NotFoundException("Selection group not found"); e.Key = request.Key; e.Label = request.Label; e.SelectionMode = request.SelectionMode; e.MinSelections = request.MinSelections; e.MaxSelections = request.MaxSelections; e.OptionSetId = request.OptionSetId; e.IsActive = request.IsActive; e.SortOrder = request.SortOrder; await _db.SaveChangesAsync(ct).ConfigureAwait(false); return Map(e); }
    public async Task DeactivateGroupAsync(Guid schemaId, Guid groupId, CancellationToken ct) { var e = await _db.SelectionGroups.SingleOrDefaultAsync(x => x.Id == groupId && x.SchemaId == schemaId, ct).ConfigureAwait(false) ?? throw new NotFoundException("Selection group not found"); e.IsActive = false; await _db.SaveChangesAsync(ct).ConfigureAwait(false); }

    public async Task<IReadOnlyList<ExtraDto>> GetExtrasAsync(bool includeInactive, CancellationToken ct)
    {
        var catalogTemplateId = await GetTenantCatalogTemplateIdAsync(ct).ConfigureAwait(false);

        return await _db.Extras.AsNoTracking()
            .Where(x => x.CatalogTemplateId == catalogTemplateId)
            .Where(x => includeInactive || x.IsActive)
            .Select(x => new ExtraDto(x.Id, x.Name, x.Price, x.IsActive, x.IsAvailable))
            .ToListAsync(ct).ConfigureAwait(false);
    }
    public async Task<ExtraDto> CreateExtraAsync(UpsertExtraRequest request, CancellationToken ct)
    {
        await _extraValidator.EnsureValidAsync(request, ct).ConfigureAwait(false);
        var catalogTemplateId = await GetTenantCatalogTemplateIdAsync(ct).ConfigureAwait(false);
        var e = new Extra { Id = Guid.NewGuid(), CatalogTemplateId = catalogTemplateId, Name = request.Name, Price = request.Price, IsActive = request.IsActive, IsAvailable = request.IsAvailable, IsInventoryTracked = request.IsInventoryTracked };
        _db.Extras.Add(e);
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
        return new ExtraDto(e.Id, e.Name, e.Price, e.IsActive, e.IsAvailable, e.IsInventoryTracked);
    }
    public async Task<ExtraDto> UpdateExtraAsync(Guid id, UpsertExtraRequest request, CancellationToken ct) { await _extraValidator.EnsureValidAsync(request, ct).ConfigureAwait(false); var e = await FindAsync(_db.Extras, id, ct).ConfigureAwait(false); var wasAvailable = e.IsAvailable; e.Name = request.Name; e.Price = request.Price; e.IsActive = request.IsActive; e.IsAvailable = request.IsAvailable; e.IsInventoryTracked = request.IsInventoryTracked; await _db.SaveChangesAsync(ct).ConfigureAwait(false); if (wasAvailable != e.IsAvailable) await AuditAsync("Extra", "UpdateExtraAvailability", e.Id, new { IsAvailable = wasAvailable }, new { e.IsAvailable }, ct).ConfigureAwait(false); return new(e.Id, e.Name, e.Price, e.IsActive, e.IsAvailable, e.IsInventoryTracked); }
    public async Task DeactivateExtraAsync(Guid id, CancellationToken ct) { var e = await FindAsync(_db.Extras, id, ct).ConfigureAwait(false); e.IsActive = false; await _db.SaveChangesAsync(ct).ConfigureAwait(false); }

    public async Task<IReadOnlyList<IncludedItemDto>> GetIncludedItemsAsync(Guid productId, CancellationToken ct) => await _db.IncludedItems.AsNoTracking().Where(x => x.ProductId == productId).Select(x => new IncludedItemDto(x.Id, x.ProductId, x.ExtraId, x.Quantity)).ToListAsync(ct).ConfigureAwait(false);
    public async Task<IReadOnlyList<IncludedItemDto>> ReplaceIncludedItemsAsync(Guid productId, ReplaceIncludedItemsRequest request, CancellationToken ct) { await _includedValidator.EnsureValidAsync(request, ct).ConfigureAwait(false); if (!await _db.Products.AnyAsync(x => x.Id == productId, ct).ConfigureAwait(false)) throw new NotFoundException("Product not found"); var extraIds = request.Items.Select(x => x.ExtraId).Distinct().ToList(); var existing = await _db.Extras.Where(x => extraIds.Contains(x.Id)).CountAsync(ct).ConfigureAwait(false); if (existing != extraIds.Count) throw new ValidationException(new Dictionary<string, string[]> { { "items", ["Extra not found"] } }); var curr = await _db.IncludedItems.Where(x => x.ProductId == productId).ToListAsync(ct).ConfigureAwait(false); _db.IncludedItems.RemoveRange(curr); foreach (var i in request.Items) { _db.IncludedItems.Add(new IncludedItem { Id = Guid.NewGuid(), ProductId = productId, ExtraId = i.ExtraId, Quantity = i.Quantity }); } await _db.SaveChangesAsync(ct).ConfigureAwait(false); return await GetIncludedItemsAsync(productId, ct).ConfigureAwait(false); }

    public async Task<ProductOverrideDto> UpsertOverrideAsync(Guid productId, string groupKey, OverrideUpsertRequest request, CancellationToken ct)
    {
        await _overrideValidator.EnsureValidAsync(request, ct).ConfigureAwait(false);
        var product = await FindAsync(_db.Products, productId, ct).ConfigureAwait(false);
        if (!product.CustomizationSchemaId.HasValue) throw new ValidationException(new Dictionary<string, string[]> { ["productId"] = ["Product has no customization schema."] });
        var group = await _db.SelectionGroups.SingleOrDefaultAsync(x => x.SchemaId == product.CustomizationSchemaId && x.Key == groupKey && x.IsActive, ct).ConfigureAwait(false)
            ?? throw new ValidationException(new Dictionary<string, string[]> { ["groupKey"] = ["GroupKey not found in product schema."] });

        var optionItems = await _db.OptionItems.Where(x => request.AllowedOptionItemIds.Contains(x.Id)).ToListAsync(ct).ConfigureAwait(false);
        if (optionItems.Count != request.AllowedOptionItemIds.Count || optionItems.Any(x => x.OptionSetId != group.OptionSetId))
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["allowedOptionItemIds"] = ["Each item must belong to group option set."] });
        }

        var existing = await _db.ProductGroupOverrides.SingleOrDefaultAsync(x => x.ProductId == productId && x.GroupKey == groupKey, ct).ConfigureAwait(false);
        var before = existing is null ? null : await BuildOverrideDto(existing, ct).ConfigureAwait(false);
        if (existing is null)
        {
            existing = new ProductGroupOverride { Id = Guid.NewGuid(), ProductId = productId, GroupKey = groupKey, IsActive = true };
            _db.ProductGroupOverrides.Add(existing);
        }

        var currentAllowed = await _db.ProductGroupOverrideAllowedItems.Where(x => x.ProductGroupOverrideId == existing.Id).ToListAsync(ct).ConfigureAwait(false);
        _db.ProductGroupOverrideAllowedItems.RemoveRange(currentAllowed);
        foreach (var id in request.AllowedOptionItemIds)
        {
            _db.ProductGroupOverrideAllowedItems.Add(new ProductGroupOverrideAllowedItem { ProductGroupOverrideId = existing.Id, OptionItemId = id });
        }

        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
        var after = await BuildOverrideDto(existing, ct).ConfigureAwait(false);
        await AuditAsync("ProductGroupOverride", "OverrideUpsert", existing.Id, before, after, ct).ConfigureAwait(false);
        return after;
    }

    public async Task<IReadOnlyList<CatalogItemOverrideDto>> GetTenantOverridesAsync(string? itemType, CancellationToken ct)
    {
        var tenantId = RequireTenantId();
        var mapping = await _db.TenantCatalogTemplates.AsNoTracking().SingleAsync(x => x.TenantId == tenantId, ct).ConfigureAwait(false);
        
        if (!mapping.CatalogTemplateId.HasValue)
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["catalogTemplateId"] = ["Tenant catalog template is not configured."] });
        }
        
        var query = _db.TenantCatalogOverrides.AsNoTracking().Where(x => x.TenantId == tenantId);
        if (!string.IsNullOrWhiteSpace(itemType) && Enum.TryParse<CatalogItemType>(itemType, true, out var parsedType))
        {
            query = query.Where(x => x.ItemType == parsedType);
        }

        var rows = await query.OrderBy(x => x.ItemType).ThenBy(x => x.ItemId).ToListAsync(ct).ConfigureAwait(false);
        return await MapOverrideRowsAsync(rows, mapping.CatalogTemplateId.Value, ct).ConfigureAwait(false);
    }

    public async Task<CatalogItemOverrideDto> UpsertTenantOverrideAsync(UpsertCatalogItemOverrideRequest request, CancellationToken ct)
    {
        var tenantId = RequireTenantId();
        if (!Enum.TryParse<CatalogItemType>(request.ItemType, true, out var itemType))
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["itemType"] = ["itemType is invalid."] });
        }

        var row = await _db.TenantCatalogOverrides.FindAsync([tenantId, itemType, request.ItemId], ct).ConfigureAwait(false);
        if (row is null)
        {
            row = new TenantCatalogOverride { TenantId = tenantId, ItemType = itemType, ItemId = request.ItemId, IsEnabled = request.IsEnabled, UpdatedAtUtc = DateTimeOffset.UtcNow };
            _db.TenantCatalogOverrides.Add(row);
        }
        else
        {
            row.IsEnabled = request.IsEnabled;
            row.UpdatedAtUtc = DateTimeOffset.UtcNow;
        }

        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
        return new CatalogItemOverrideDto(row.ItemType.ToString(), row.ItemId, row.IsEnabled, row.UpdatedAtUtc);
    }

    public async Task<IReadOnlyList<CatalogStoreAvailabilityDto>> GetStoreAvailabilityOverridesAsync(Guid storeId, string? itemType, CancellationToken ct)
    {
        var tenantId = RequireTenantId();
        var storeBelongs = await _db.Stores.AsNoTracking().AnyAsync(x => x.Id == storeId && x.TenantId == tenantId, ct).ConfigureAwait(false);
        if (!storeBelongs)
        {
            throw new ForbiddenException("Store does not belong to tenant.");
        }

        var mapping = await _db.TenantCatalogTemplates.AsNoTracking().SingleAsync(x => x.TenantId == tenantId, ct).ConfigureAwait(false);
        var query = _db.StoreCatalogAvailabilities.AsNoTracking().Where(x => x.StoreId == storeId);
        if (!string.IsNullOrWhiteSpace(itemType) && Enum.TryParse<CatalogItemType>(itemType, true, out var parsedType))
        {
            query = query.Where(x => x.ItemType == parsedType);
        }

        var rows = await query.OrderBy(x => x.ItemType).ThenBy(x => x.ItemId).ToListAsync(ct).ConfigureAwait(false);
        if (!mapping.CatalogTemplateId.HasValue)
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["catalogTemplateId"] = ["Tenant catalog template is not configured."] });
        }
        var itemDetails = await BuildTemplateItemLookupAsync(mapping.CatalogTemplateId.Value, ct).ConfigureAwait(false);
        return rows.Select(x =>
        {
            itemDetails.TryGetValue((x.ItemType, x.ItemId), out var detail);
            return new CatalogStoreAvailabilityDto(x.StoreId, x.ItemType.ToString(), x.ItemId, x.IsAvailable, x.UpdatedAtUtc, detail?.ItemName ?? string.Empty, detail?.ItemSku);
        }).ToList();
    }

    public async Task<CatalogStoreAvailabilityDto> UpsertStoreAvailabilityAsync(UpsertCatalogStoreAvailabilityRequest request, CancellationToken ct)
    {
        var tenantId = RequireTenantId();
        var storeBelongs = await _db.Stores.AsNoTracking().AnyAsync(x => x.Id == request.StoreId && x.TenantId == tenantId, ct).ConfigureAwait(false);
        if (!storeBelongs)
        {
            throw new ForbiddenException("Store does not belong to tenant.");
        }

        if (!Enum.TryParse<CatalogItemType>(request.ItemType, true, out var itemType))
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["itemType"] = ["itemType is invalid."] });
        }

        var row = await _db.StoreCatalogAvailabilities.FindAsync([request.StoreId, itemType, request.ItemId], ct).ConfigureAwait(false);
        if (row is null)
        {
            row = new StoreCatalogAvailability { StoreId = request.StoreId, ItemType = itemType, ItemId = request.ItemId, IsAvailable = request.IsAvailable, UpdatedAtUtc = DateTimeOffset.UtcNow };
            _db.StoreCatalogAvailabilities.Add(row);
        }
        else
        {
            row.IsAvailable = request.IsAvailable;
            row.UpdatedAtUtc = DateTimeOffset.UtcNow;
        }

        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
        return new CatalogStoreAvailabilityDto(row.StoreId, row.ItemType.ToString(), row.ItemId, row.IsAvailable, row.UpdatedAtUtc);
    }

    public async Task<IReadOnlyList<CatalogStoreOverrideDto>> GetStoreOverridesAsync(Guid storeId, string? itemType, bool onlyOverrides, CancellationToken ct)
    {
        var tenantId = RequireTenantId();
        await EnsureStoreBelongsToTenantAsync(storeId, tenantId, ct).ConfigureAwait(false);
        var query = _db.StoreCatalogOverrides.AsNoTracking().Where(x => x.StoreId == storeId && x.TenantId == tenantId);
        if (!string.IsNullOrWhiteSpace(itemType) && Enum.TryParse<CatalogItemType>(itemType, true, out var parsed))
        {
            query = query.Where(x => x.ItemType == parsed);
        }

        var rows = await query.OrderBy(x => x.ItemType).ThenBy(x => x.ItemId).ToListAsync(ct).ConfigureAwait(false);
        if (onlyOverrides)
        {
            return rows.Select(x => new CatalogStoreOverrideDto(x.StoreId, x.ItemType.ToString(), x.ItemId, x.OverrideState.ToString(), x.UpdatedAtUtc)).ToList();
        }

        return rows.Select(x => new CatalogStoreOverrideDto(x.StoreId, x.ItemType.ToString(), x.ItemId, x.OverrideState.ToString(), x.UpdatedAtUtc)).ToList();
    }

    public async Task<CatalogStoreOverrideDto> UpsertStoreOverrideAsync(UpsertCatalogStoreOverrideRequest request, CancellationToken ct)
    {
        var tenantId = RequireTenantId();
        await EnsureStoreBelongsToTenantAsync(request.StoreId, tenantId, ct).ConfigureAwait(false);
        if (!Enum.TryParse<CatalogItemType>(request.ItemType, true, out var itemType))
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["itemType"] = ["itemType is invalid."] });
        }
        if (!Enum.TryParse<CatalogOverrideState>(request.State, true, out var state))
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["state"] = ["state must be Enabled or Disabled."] });
        }

        var row = await _db.StoreCatalogOverrides.SingleOrDefaultAsync(x => x.StoreId == request.StoreId && x.ItemType == itemType && x.ItemId == request.ItemId, ct).ConfigureAwait(false);
        if (row is null)
        {
            row = new StoreCatalogOverride { Id = Guid.NewGuid(), TenantId = tenantId, StoreId = request.StoreId, ItemType = itemType, ItemId = request.ItemId, OverrideState = state, CreatedAtUtc = DateTimeOffset.UtcNow, UpdatedAtUtc = DateTimeOffset.UtcNow };
            _db.StoreCatalogOverrides.Add(row);
        }
        else
        {
            row.OverrideState = state;
            row.UpdatedAtUtc = DateTimeOffset.UtcNow;
        }

        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
        return new CatalogStoreOverrideDto(row.StoreId, row.ItemType.ToString(), row.ItemId, row.OverrideState.ToString(), row.UpdatedAtUtc);
    }

    public async Task DeleteStoreOverrideAsync(Guid storeId, string itemType, Guid itemId, CancellationToken ct)
    {
        var tenantId = RequireTenantId();
        await EnsureStoreBelongsToTenantAsync(storeId, tenantId, ct).ConfigureAwait(false);
        if (!Enum.TryParse<CatalogItemType>(itemType, true, out var parsed))
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["itemType"] = ["itemType is invalid."] });
        }

        var row = await _db.StoreCatalogOverrides.SingleOrDefaultAsync(x => x.StoreId == storeId && x.ItemType == parsed && x.ItemId == itemId, ct).ConfigureAwait(false);
        if (row is null)
        {
            return;
        }

        _db.StoreCatalogOverrides.Remove(row);
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<CatalogInventoryItemDto>> GetCatalogInventoryAsync(Guid storeId, string? itemType, Guid? itemId, bool onlyTracked, CancellationToken ct)
    {
        var tenantId = RequireTenantId();
        await EnsureStoreBelongsToTenantAsync(storeId, tenantId, ct).ConfigureAwait(false);
        var query = _db.CatalogInventoryBalances.AsNoTracking().Where(x => x.StoreId == storeId && x.TenantId == tenantId);
        if (!string.IsNullOrWhiteSpace(itemType) && Enum.TryParse<CatalogItemType>(itemType, true, out var parsed))
        {
            if (parsed == CatalogItemType.OptionItem) throw new ValidationException(new Dictionary<string, string[]> { ["itemType"] = ["OptionItem is not inventory-trackable in v1."] });
            query = query.Where(x => x.ItemType == parsed);
        }
        if (itemId.HasValue) query = query.Where(x => x.ItemId == itemId.Value);
        if (onlyTracked)
        {
            var trackedProducts = _db.Products.AsNoTracking().Where(x => x.IsInventoryTracked).Select(x => x.Id);
            var trackedExtras = _db.Extras.AsNoTracking().Where(x => x.IsInventoryTracked).Select(x => x.Id);
            query = query.Where(x => (x.ItemType == CatalogItemType.Product && trackedProducts.Contains(x.ItemId)) || (x.ItemType == CatalogItemType.Extra && trackedExtras.Contains(x.ItemId)));
        }

        return await query.OrderBy(x => x.ItemType).ThenBy(x => x.ItemId)
            .Select(x => new CatalogInventoryItemDto(x.StoreId, x.ItemType.ToString(), x.ItemId, x.OnHandQty, x.UpdatedAtUtc))
            .ToListAsync(ct).ConfigureAwait(false);
    }

    public async Task<PagedInventoryBalancesDto> GetInventoryBalancesV2Async(Guid storeId, string? query, Guid? categoryId, bool? tracked, decimal? onHandMin, decimal? onHandMax, int page, int pageSize, CancellationToken ct)
    {
        var tenantId = RequireTenantId();
        var storeBelongs = await _db.Stores.AsNoTracking().AnyAsync(x => x.Id == storeId && x.TenantId == tenantId, ct).ConfigureAwait(false);
        if (!storeBelongs)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["storeId"] = ["Store does not belong to tenant."]
            });
        }

        var safePage = Math.Max(page, 1);
        var safePageSize = Math.Clamp(pageSize, 1, 200);
        var catalogTemplateId = await GetTenantCatalogTemplateIdAsync(ct).ConfigureAwait(false);
        var term = query?.Trim();

        if (onHandMin.HasValue && onHandMax.HasValue && onHandMin.Value > onHandMax.Value)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["onHandMin"] = ["onHandMin must be less than or equal to onHandMax."]
            });
        }

        var productRows = from product in _db.Products.AsNoTracking()
                          where product.CatalogTemplateId == catalogTemplateId && product.IsActive
                          join category in _db.Categories.AsNoTracking() on product.CategoryId equals category.Id
                          join balance in _db.CatalogInventoryBalances.AsNoTracking().Where(x => x.TenantId == tenantId && x.StoreId == storeId && x.ItemType == CatalogItemType.Product)
                              on product.Id equals balance.ItemId into productBalances
                          from balance in productBalances.DefaultIfEmpty()
                          where !tracked.HasValue || product.IsInventoryTracked == tracked.Value
                          where !categoryId.HasValue || product.CategoryId == categoryId.Value
                          where string.IsNullOrWhiteSpace(term)
                                || product.Name.Contains(term!)
                                || (product.ExternalCode != null && product.ExternalCode.Contains(term!))
                          select new
                          {
                              ItemType = "Product",
                              ItemId = product.Id,
                              product.Name,
                              Sku = product.ExternalCode,
                              CategoryName = category.Name,
                              product.IsInventoryTracked,
                              OnHandQty = balance != null ? balance.OnHandQty : 0m,
                              UpdatedAtUtc = balance != null ? balance.UpdatedAtUtc : (DateTimeOffset?)null,
                              BalanceVersion = balance != null ? balance.RowVersion : null
                          };

        var extraRows = from extra in _db.Extras.AsNoTracking()
                        where extra.CatalogTemplateId == catalogTemplateId && extra.IsActive
                        join balance in _db.CatalogInventoryBalances.AsNoTracking().Where(x => x.TenantId == tenantId && x.StoreId == storeId && x.ItemType == CatalogItemType.Extra)
                            on extra.Id equals balance.ItemId into extraBalances
                        from balance in extraBalances.DefaultIfEmpty()
                        where !tracked.HasValue || extra.IsInventoryTracked == tracked.Value
                        where string.IsNullOrWhiteSpace(term) || extra.Name.Contains(term!)
                        select new
                        {
                            ItemType = "Extra",
                            ItemId = extra.Id,
                            extra.Name,
                            Sku = (string?)null,
                            CategoryName = (string?)null,
                            extra.IsInventoryTracked,
                            OnHandQty = balance != null ? balance.OnHandQty : 0m,
                            UpdatedAtUtc = balance != null ? balance.UpdatedAtUtc : (DateTimeOffset?)null,
                            BalanceVersion = balance != null ? balance.RowVersion : null
                        };

        var merged = productRows.Concat(extraRows);

        if (onHandMin.HasValue)
        {
            merged = merged.Where(x => x.OnHandQty >= onHandMin.Value);
        }

        if (onHandMax.HasValue)
        {
            merged = merged.Where(x => x.OnHandQty <= onHandMax.Value);
        }

        var totalCount = await merged.CountAsync(ct).ConfigureAwait(false);
        var pageRows = await merged
            .OrderBy(x => x.Name)
            .ThenBy(x => x.ItemType)
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .ToListAsync(ct)
            .ConfigureAwait(false);

        var items = pageRows
            .Select(x => new InventoryBalanceRowDto(
                x.ItemType,
                x.ItemId,
                x.Name,
                x.Sku,
                x.CategoryName,
                x.IsInventoryTracked,
                x.OnHandQty,
                x.UpdatedAtUtc,
                x.BalanceVersion is null ? null : Convert.ToBase64String(x.BalanceVersion)))
            .ToList();

        return new PagedInventoryBalancesDto(items, totalCount, safePage, safePageSize);
    }

    public async Task<IReadOnlyList<InventoryBalanceRowDto>> GetInventoryBalancesV2ExportAsync(Guid storeId, string? query, Guid? categoryId, bool? tracked, decimal? onHandMin, decimal? onHandMax, int maxRows, CancellationToken ct)
    {
        var tenantId = RequireTenantId();
        var storeBelongs = await _db.Stores.AsNoTracking().AnyAsync(x => x.Id == storeId && x.TenantId == tenantId, ct).ConfigureAwait(false);
        if (!storeBelongs)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["storeId"] = ["Store does not belong to tenant."]
            });
        }

        if (onHandMin.HasValue && onHandMax.HasValue && onHandMin.Value > onHandMax.Value)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["onHandMin"] = ["onHandMin must be less than or equal to onHandMax."]
            });
        }

        var safeTake = Math.Clamp(maxRows, 1, 100000);
        var catalogTemplateId = await GetTenantCatalogTemplateIdAsync(ct).ConfigureAwait(false);
        var term = query?.Trim();

        var productRows = from product in _db.Products.AsNoTracking()
                          where product.CatalogTemplateId == catalogTemplateId && product.IsActive
                          join category in _db.Categories.AsNoTracking() on product.CategoryId equals category.Id
                          join balance in _db.CatalogInventoryBalances.AsNoTracking().Where(x => x.TenantId == tenantId && x.StoreId == storeId && x.ItemType == CatalogItemType.Product)
                              on product.Id equals balance.ItemId into productBalances
                          from balance in productBalances.DefaultIfEmpty()
                          where !tracked.HasValue || product.IsInventoryTracked == tracked.Value
                          where !categoryId.HasValue || product.CategoryId == categoryId.Value
                          where string.IsNullOrWhiteSpace(term)
                                || product.Name.Contains(term!)
                                || (product.ExternalCode != null && product.ExternalCode.Contains(term!))
                          select new
                          {
                              ItemType = "Product",
                              ItemId = product.Id,
                              product.Name,
                              Sku = product.ExternalCode,
                              CategoryName = category.Name,
                              product.IsInventoryTracked,
                              OnHandQty = balance != null ? balance.OnHandQty : 0m,
                              UpdatedAtUtc = balance != null ? balance.UpdatedAtUtc : (DateTimeOffset?)null,
                              BalanceVersion = balance != null ? balance.RowVersion : null
                          };

        var extraRows = from extra in _db.Extras.AsNoTracking()
                        where extra.CatalogTemplateId == catalogTemplateId && extra.IsActive
                        join balance in _db.CatalogInventoryBalances.AsNoTracking().Where(x => x.TenantId == tenantId && x.StoreId == storeId && x.ItemType == CatalogItemType.Extra)
                            on extra.Id equals balance.ItemId into extraBalances
                        from balance in extraBalances.DefaultIfEmpty()
                        where !tracked.HasValue || extra.IsInventoryTracked == tracked.Value
                        where string.IsNullOrWhiteSpace(term) || extra.Name.Contains(term!)
                        select new
                        {
                            ItemType = "Extra",
                            ItemId = extra.Id,
                            extra.Name,
                            Sku = (string?)null,
                            CategoryName = (string?)null,
                            extra.IsInventoryTracked,
                            OnHandQty = balance != null ? balance.OnHandQty : 0m,
                            UpdatedAtUtc = balance != null ? balance.UpdatedAtUtc : (DateTimeOffset?)null,
                            BalanceVersion = balance != null ? balance.RowVersion : null
                        };

        var merged = productRows.Concat(extraRows);

        if (onHandMin.HasValue)
        {
            merged = merged.Where(x => x.OnHandQty >= onHandMin.Value);
        }

        if (onHandMax.HasValue)
        {
            merged = merged.Where(x => x.OnHandQty <= onHandMax.Value);
        }

        var rows = await merged
            .OrderBy(x => x.Name)
            .ThenBy(x => x.ItemType)
            .Take(safeTake)
            .ToListAsync(ct)
            .ConfigureAwait(false);

        return rows
            .Select(x => new InventoryBalanceRowDto(
                x.ItemType,
                x.ItemId,
                x.Name,
                x.Sku,
                x.CategoryName,
                x.IsInventoryTracked,
                x.OnHandQty,
                x.UpdatedAtUtc,
                x.BalanceVersion is null ? null : Convert.ToBase64String(x.BalanceVersion)))
            .ToList();
    }

    public async Task<PagedInventoryMovementsDto> GetInventoryMovementsV2Async(Guid storeId, string itemType, Guid itemId, DateTimeOffset? fromUtc, DateTimeOffset? toUtc, string? reason, string? referenceType, string? referenceId, Guid? createdByUserId, int page, int pageSize, CancellationToken ct)
    {
        var tenantId = RequireTenantId();
        await EnsureStoreBelongsToTenantAsync(storeId, tenantId, ct).ConfigureAwait(false);

        var parsedItemType = ParseInventoryTrackableItemType(itemType);
        var safePage = Math.Max(page, 1);
        var safePageSize = Math.Clamp(pageSize, 1, 200);
        var now = DateTimeOffset.UtcNow;
        var safeToUtc = toUtc ?? now;
        var safeFromUtc = fromUtc ?? safeToUtc.AddDays(-30);

        if (safeFromUtc > safeToUtc)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["from"] = ["from must be less than or equal to to."]
            });
        }

        if (safeToUtc - safeFromUtc > TimeSpan.FromDays(366))
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["to"] = ["Date range cannot exceed 366 days."]
            });
        }

        InventoryAdjustmentReason? parsedReason = null;
        if (!string.IsNullOrWhiteSpace(reason))
        {
            if (!Enum.TryParse<InventoryAdjustmentReason>(reason.Trim(), true, out var reasonCode))
            {
                throw new ValidationException(new Dictionary<string, string[]>
                {
                    ["reason"] = ["reason is invalid."]
                });
            }

            parsedReason = reasonCode;
        }

        var normalizedReferenceType = string.IsNullOrWhiteSpace(referenceType) ? null : referenceType.Trim();
        var normalizedReferenceId = string.IsNullOrWhiteSpace(referenceId) ? null : referenceId.Trim();

        var baseQuery = _db.CatalogInventoryAdjustments.AsNoTracking()
            .Where(x => x.TenantId == tenantId
                && x.StoreId == storeId
                && x.ItemType == parsedItemType
                && x.ItemId == itemId
                && x.CreatedAtUtc >= safeFromUtc
                && x.CreatedAtUtc <= safeToUtc);

        if (parsedReason.HasValue)
        {
            var reasonCode = parsedReason.Value.ToString();
            baseQuery = baseQuery.Where(x => x.Reason == reasonCode);
        }

        if (!string.IsNullOrWhiteSpace(normalizedReferenceType))
        {
            baseQuery = baseQuery.Where(x => x.ReferenceType == normalizedReferenceType);
        }

        if (!string.IsNullOrWhiteSpace(normalizedReferenceId))
        {
            baseQuery = baseQuery.Where(x => x.ReferenceId == normalizedReferenceId);
        }

        if (createdByUserId.HasValue)
        {
            baseQuery = baseQuery.Where(x => x.CreatedByUserId == createdByUserId.Value);
        }

        var totalCount = await baseQuery.CountAsync(ct).ConfigureAwait(false);
        var rows = await baseQuery
            .OrderByDescending(x => x.CreatedAtUtc)
            .ThenByDescending(x => x.Id)
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .Select(x => new
            {
                x.Id,
                x.CreatedAtUtc,
                x.Reason,
                x.ReferenceType,
                x.ReferenceId,
                x.Note,
                x.CreatedByUserId,
                x.DeltaQty,
                x.QtyBefore,
                x.ResultingOnHandQty,
                x.ClientOperationId
            })
            .ToListAsync(ct)
            .ConfigureAwait(false);

        var userIds = rows
            .Where(x => x.CreatedByUserId.HasValue)
            .Select(x => x.CreatedByUserId!.Value)
            .Distinct()
            .ToList();

        var userMap = userIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await _db.Users.AsNoTracking()
                .Where(x => userIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.Email ?? x.UserName ?? x.Id.ToString(), ct)
                .ConfigureAwait(false);

        var movementRows = rows.Select(x =>
        {
            var hasAnomaly = x.ResultingOnHandQty < 0m || x.QtyBefore < 0m || x.QtyBefore + x.DeltaQty != x.ResultingOnHandQty;
            if (hasAnomaly)
            {
                PosCatalogLog.InventoryMovementAnomalyDetected(
                    _logger,
                    tenantId,
                    storeId,
                    parsedItemType,
                    itemId,
                    x.Id,
                    x.QtyBefore,
                    x.DeltaQty,
                    x.ResultingOnHandQty);
            }

            userMap.TryGetValue(x.CreatedByUserId ?? Guid.Empty, out var displayName);
            return new InventoryMovementRowDto(
                x.Id,
                x.CreatedAtUtc,
                x.Reason,
                x.ReferenceType,
                x.ReferenceId,
                x.Note,
                x.CreatedByUserId,
                displayName,
                x.DeltaQty,
                x.QtyBefore,
                x.ResultingOnHandQty,
                x.ClientOperationId,
                hasAnomaly);
        }).ToList();

        return new PagedInventoryMovementsDto(movementRows, totalCount, safePage, safePageSize);
    }

    public async Task<InventoryAdjustmentV2ResultDto> CreateInventoryAdjustmentV2Async(CreateInventoryAdjustmentV2Request request, CancellationToken ct)
    {
        const int deltaMaxAttempts = 3;

        var tenantId = RequireTenantId();
        await EnsureStoreBelongsToTenantAsync(request.StoreId, tenantId, ct).ConfigureAwait(false);

        if (string.IsNullOrWhiteSpace(request.ClientOperationId) || !Guid.TryParse(request.ClientOperationId, out _))
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["clientOperationId"] = ["clientOperationId is required and must be a GUID."] });
        }

        var reasonCode = request.ReasonCode?.Trim();
        if (string.IsNullOrWhiteSpace(reasonCode) || !Enum.TryParse<InventoryAdjustmentReason>(reasonCode, true, out var parsedReason))
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["reasonCode"] = ["reasonCode is required and must be valid."] });
        }

        var itemType = ParseInventoryTrackableItemType(request.ItemType);
        _ = await EnsureInventoryItemTrackableAsync(itemType, request.ItemId, ct).ConfigureAwait(false);

        var operationType = request.OperationType?.Trim();
        if (!string.Equals(operationType, "Delta", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(operationType, "Set", StringComparison.OrdinalIgnoreCase))
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["operationType"] = ["operationType must be Delta or Set."] });
        }

        var duplicated = await _db.CatalogInventoryAdjustments.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.StoreId == request.StoreId && x.ClientOperationId == request.ClientOperationId)
            .OrderByDescending(x => x.CreatedAtUtc)
            .FirstOrDefaultAsync(ct)
            .ConfigureAwait(false);
        if (duplicated is not null)
        {
            if (!string.Equals(duplicated.ItemType.ToString(), itemType.ToString(), StringComparison.OrdinalIgnoreCase)
                || duplicated.ItemId != request.ItemId
                || !string.Equals(duplicated.Reason, parsedReason.ToString(), StringComparison.OrdinalIgnoreCase)
                || duplicated.Reference != request.Reference)
            {
                throw new InventoryAdjustmentConflictException("IDEMPOTENCY_CONFLICT", "clientOperationId was already used with a different payload.");
            }

            return await GetExistingByClientOperationAsync().ConfigureAwait(false);
        }

        var userId = GetCurrentUserId();
        if (string.Equals(operationType, "Delta", StringComparison.OrdinalIgnoreCase))
        {
            if (!request.QuantityDelta.HasValue || request.QuantityDelta.Value == 0m)
            {
                throw new ValidationException(new Dictionary<string, string[]> { ["quantityDelta"] = ["quantityDelta must be different from zero."] });
            }

            var delta = request.QuantityDelta.Value;
            for (var attempt = 1; attempt <= deltaMaxAttempts; attempt++)
            {
                _db.ChangeTracker.Clear();

                var now = DateTimeOffset.UtcNow;
                var row = await _db.CatalogInventoryBalances.SingleOrDefaultAsync(
                        x => x.StoreId == request.StoreId && x.TenantId == tenantId && x.ItemType == itemType && x.ItemId == request.ItemId,
                        ct)
                    .ConfigureAwait(false);
                var qtyBefore = row?.OnHandQty ?? 0m;
                var qtyAfter = qtyBefore + delta;
                if (qtyAfter < 0m)
                {
                    throw new InventoryAdjustmentConflictException("NEGATIVE_STOCK", "Resulting stock cannot be negative.");
                }

                if (row is null)
                {
                    row = new CatalogInventoryBalance
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        StoreId = request.StoreId,
                        ItemType = itemType,
                        ItemId = request.ItemId,
                        OnHandQty = qtyAfter,
                        UpdatedAtUtc = now
                    };
                    _db.CatalogInventoryBalances.Add(row);
                }
                else
                {
                    row.OnHandQty = qtyAfter;
                    row.UpdatedAtUtc = now;
                }

                var adjustment = new CatalogInventoryAdjustment
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    StoreId = request.StoreId,
                    ItemType = itemType,
                    ItemId = request.ItemId,
                    QtyBefore = qtyBefore,
                    DeltaQty = delta,
                    ResultingOnHandQty = qtyAfter,
                    Reason = parsedReason.ToString(),
                    Reference = request.Reference,
                    Note = request.Note,
                    ClientOperationId = request.ClientOperationId,
                    CreatedAtUtc = now,
                    CreatedByUserId = userId
                };
                _db.CatalogInventoryAdjustments.Add(adjustment);

                try
                {
                    await _db.SaveChangesAsync(ct).ConfigureAwait(false);
                    return new InventoryAdjustmentV2ResultDto(adjustment.Id, adjustment.StoreId, adjustment.ItemType.ToString(), adjustment.ItemId, qtyBefore, qtyAfter, delta, Convert.ToBase64String(row.RowVersion), adjustment.CreatedAtUtc, adjustment.Reason, adjustment.Reference);
                }
                catch (DbUpdateConcurrencyException) when (attempt < deltaMaxAttempts)
                {
                    continue;
                }
                catch (DbUpdateConcurrencyException)
                {
                    throw new InventoryAdjustmentConflictException("CONCURRENCY_CONFLICT", "Balance version mismatch.");
                }
                catch (DbUpdateException dbEx) when (dbEx.InnerException?.Message.Contains("ClientOperationId", StringComparison.OrdinalIgnoreCase) == true)
                {
                    return await GetExistingByClientOperationAsync().ConfigureAwait(false);
                }
            }

            throw new InventoryAdjustmentConflictException("CONCURRENCY_CONFLICT", "Balance version mismatch.");
        }

        if (!request.QuantitySet.HasValue)
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["quantitySet"] = ["quantitySet is required for Set."] });
        }

        if (string.IsNullOrWhiteSpace(request.ExpectedVersion))
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["expectedVersion"] = ["expectedVersion is required for Set."] });
        }

        var setNow = DateTimeOffset.UtcNow;
        var setRow = await _db.CatalogInventoryBalances.SingleOrDefaultAsync(x => x.StoreId == request.StoreId && x.TenantId == tenantId && x.ItemType == itemType && x.ItemId == request.ItemId, ct).ConfigureAwait(false);
        var setQtyBefore = setRow?.OnHandQty ?? 0m;
        if (setRow is not null)
        {
            var currentVersion = Convert.ToBase64String(setRow.RowVersion);
            if (!string.Equals(currentVersion, request.ExpectedVersion, StringComparison.Ordinal))
            {
                throw new InventoryAdjustmentConflictException("CONCURRENCY_CONFLICT", "Balance version mismatch.");
            }
        }

        var setQtyAfter = request.QuantitySet.Value;
        var setDelta = setQtyAfter - setQtyBefore;
        if (setDelta == 0m)
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["quantitySet"] = ["quantitySet must produce a change."] });
        }

        if (setQtyAfter < 0m)
        {
            throw new InventoryAdjustmentConflictException("NEGATIVE_STOCK", "Resulting stock cannot be negative.");
        }

        if (setRow is null)
        {
            setRow = new CatalogInventoryBalance
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                StoreId = request.StoreId,
                ItemType = itemType,
                ItemId = request.ItemId,
                OnHandQty = setQtyAfter,
                UpdatedAtUtc = setNow
            };
            _db.CatalogInventoryBalances.Add(setRow);
        }
        else
        {
            setRow.OnHandQty = setQtyAfter;
            setRow.UpdatedAtUtc = setNow;
        }

        var setAdjustment = new CatalogInventoryAdjustment
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            StoreId = request.StoreId,
            ItemType = itemType,
            ItemId = request.ItemId,
            QtyBefore = setQtyBefore,
            DeltaQty = setDelta,
            ResultingOnHandQty = setQtyAfter,
            Reason = parsedReason.ToString(),
            Reference = request.Reference,
            Note = request.Note,
            ClientOperationId = request.ClientOperationId,
            CreatedAtUtc = setNow,
            CreatedByUserId = userId
        };
        _db.CatalogInventoryAdjustments.Add(setAdjustment);

        try
        {
            await _db.SaveChangesAsync(ct).ConfigureAwait(false);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new InventoryAdjustmentConflictException("CONCURRENCY_CONFLICT", "Balance version mismatch.");
        }
        catch (DbUpdateException dbEx) when (dbEx.InnerException?.Message.Contains("ClientOperationId", StringComparison.OrdinalIgnoreCase) == true)
        {
            return await GetExistingByClientOperationAsync().ConfigureAwait(false);
        }

        return new InventoryAdjustmentV2ResultDto(setAdjustment.Id, setAdjustment.StoreId, setAdjustment.ItemType.ToString(), setAdjustment.ItemId, setQtyBefore, setQtyAfter, setDelta, Convert.ToBase64String(setRow.RowVersion), setAdjustment.CreatedAtUtc, setAdjustment.Reason, setAdjustment.Reference);

        async Task<InventoryAdjustmentV2ResultDto> GetExistingByClientOperationAsync()
        {
            var existing = await _db.CatalogInventoryAdjustments.AsNoTracking()
                .Where(x => x.TenantId == tenantId && x.StoreId == request.StoreId && x.ClientOperationId == request.ClientOperationId)
                .OrderByDescending(x => x.CreatedAtUtc)
                .FirstAsync(ct)
                .ConfigureAwait(false);
            var savedBalance = await _db.CatalogInventoryBalances.AsNoTracking()
                .SingleAsync(x => x.TenantId == tenantId && x.StoreId == request.StoreId && x.ItemType == itemType && x.ItemId == request.ItemId, ct)
                .ConfigureAwait(false);
            return new InventoryAdjustmentV2ResultDto(existing.Id, existing.StoreId, existing.ItemType.ToString(), existing.ItemId, existing.QtyBefore, existing.ResultingOnHandQty, existing.DeltaQty, Convert.ToBase64String(savedBalance.RowVersion), existing.CreatedAtUtc, existing.Reason, existing.Reference);
        }
    }

    public async Task<InventoryAdjustmentV2BatchResultDto> CreateInventoryAdjustmentBatchV2Async(CreateInventoryAdjustmentV2BatchRequest request, CancellationToken ct)
    {
        const int maxLines = 2000;
        var tenantId = RequireTenantId();
        await EnsureStoreBelongsToTenantAsync(request.StoreId, tenantId, ct).ConfigureAwait(false);

        if (request.BatchClientOperationId == Guid.Empty)
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["batchClientOperationId"] = ["batchClientOperationId is required and must be a GUID."] });
        }

        if (string.IsNullOrWhiteSpace(request.ReasonCode) || !Enum.TryParse<InventoryAdjustmentReason>(request.ReasonCode, true, out _))
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["reasonCode"] = ["reasonCode is required and must be valid."] });
        }

        if (request.Lines is null || request.Lines.Count == 0 || request.Lines.Count > maxLines)
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["lines"] = [$"lines is required and must be between 1 and {maxLines}."] });
        }

        var requestHash = ComputeBatchRequestHash(request);
        var existingBatch = await _db.CatalogInventoryBatchOperations.AsNoTracking()
            .SingleOrDefaultAsync(x => x.TenantId == tenantId && x.StoreId == request.StoreId && x.BatchClientOperationId == request.BatchClientOperationId, ct)
            .ConfigureAwait(false);
        if (existingBatch is not null)
        {
            if (!string.Equals(existingBatch.RequestHash, requestHash, StringComparison.Ordinal))
            {
                throw new InventoryAdjustmentConflictException("IDEMPOTENCY_CONFLICT", "batchClientOperationId was already used with a different payload.");
            }

            return JsonSerializer.Deserialize<InventoryAdjustmentV2BatchResultDto>(existingBatch.ResultJson)!;
        }

        var lineResults = new List<InventoryAdjustmentV2BatchLineResultDto>(request.Lines.Count);
        var appliedCount = 0;
        var failedCount = 0;

        foreach (var line in request.Lines.OrderBy(x => x.LineNo))
        {
            var clampedDelta = decimal.Round(line.DeltaQty, 3, MidpointRounding.AwayFromZero);
            var lineOperationId = (line.LineClientOperationId ?? DeriveLineClientOperationId(request.BatchClientOperationId, line.LineNo)).ToString("D");
            var normalizedItemType = line.ItemType?.Trim() ?? string.Empty;

            if (line.LineNo <= 0 || clampedDelta == 0m)
            {
                failedCount++;
                lineResults.Add(new InventoryAdjustmentV2BatchLineResultDto(line.LineNo, normalizedItemType, line.ExternalCode, line.ItemId, "Failed", "VALIDATION_ERROR", "lineNo must be > 0 and deltaQty cannot be zero.", null, null, null, null));
                continue;
            }

            Guid resolvedItemId;
            if (line.ItemId.HasValue)
            {
                resolvedItemId = line.ItemId.Value;
            }
            else if (string.Equals(normalizedItemType, CatalogItemType.Product.ToString(), StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(line.ExternalCode))
            {
                var catalogTemplateId = await GetTenantCatalogTemplateIdAsync(ct).ConfigureAwait(false);
                var productId = await _db.Products.AsNoTracking()
                    .Where(x => x.CatalogTemplateId == catalogTemplateId && x.ExternalCode == line.ExternalCode)
                    .Select(x => (Guid?)x.Id)
                    .SingleOrDefaultAsync(ct)
                    .ConfigureAwait(false);
                if (!productId.HasValue)
                {
                    failedCount++;
                    lineResults.Add(new InventoryAdjustmentV2BatchLineResultDto(line.LineNo, normalizedItemType, line.ExternalCode, null, "Failed", "UNKNOWN_ITEM", "Unable to resolve item.", null, null, null, null));
                    continue;
                }

                resolvedItemId = productId.Value;
            }
            else
            {
                failedCount++;
                lineResults.Add(new InventoryAdjustmentV2BatchLineResultDto(line.LineNo, normalizedItemType, line.ExternalCode, line.ItemId, "Failed", "UNKNOWN_ITEM", "Unable to resolve item.", null, null, null, null));
                continue;
            }

            try
            {
                var response = await CreateInventoryAdjustmentV2Async(new CreateInventoryAdjustmentV2Request(
                    request.StoreId,
                    normalizedItemType,
                    resolvedItemId,
                    "Delta",
                    clampedDelta,
                    null,
                    request.ReasonCode,
                    request.ReferenceId,
                    request.Note,
                    lineOperationId), ct).ConfigureAwait(false);
                appliedCount++;
                lineResults.Add(new InventoryAdjustmentV2BatchLineResultDto(line.LineNo, response.ItemType, line.ExternalCode, response.ItemId, "Applied", null, null, response.QtyBefore, response.QtyAfter, response.DeltaApplied, response.AdjustmentId));
            }
            catch (InventoryAdjustmentConflictException ex)
            {
                failedCount++;
                var errorCode = ex.Reason is "NEGATIVE_STOCK" or "CONCURRENCY_CONFLICT" or "IDEMPOTENCY_CONFLICT"
                    ? ex.Reason
                    : "VALIDATION_ERROR";
                lineResults.Add(new InventoryAdjustmentV2BatchLineResultDto(line.LineNo, normalizedItemType, line.ExternalCode, resolvedItemId, "Failed", errorCode, ex.Message, null, null, null, null));
            }
            catch (ValidationException ex)
            {
                failedCount++;
                var code = ex.Errors.ContainsKey("itemId") || ex.Errors.ContainsKey("itemType") ? "UNKNOWN_ITEM" : "VALIDATION_ERROR";
                lineResults.Add(new InventoryAdjustmentV2BatchLineResultDto(line.LineNo, normalizedItemType, line.ExternalCode, resolvedItemId, "Failed", code, ex.Message, null, null, null, null));
            }
        }

        var result = new InventoryAdjustmentV2BatchResultDto(request.BatchClientOperationId, appliedCount, failedCount, lineResults);
        PosCatalogLog.InventoryBatchAdjustmentProcessed(_logger, tenantId, request.StoreId, request.BatchClientOperationId, appliedCount, failedCount);

        var json = JsonSerializer.Serialize(result);
        _db.CatalogInventoryBatchOperations.Add(new CatalogInventoryBatchOperation
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            StoreId = request.StoreId,
            BatchClientOperationId = request.BatchClientOperationId,
            RequestHash = requestHash,
            ResultJson = json,
            CreatedAtUtc = DateTimeOffset.UtcNow
        });

        try
        {
            await _db.SaveChangesAsync(ct).ConfigureAwait(false);
        }
        catch (DbUpdateException)
        {
            var replay = await _db.CatalogInventoryBatchOperations.AsNoTracking()
                .SingleAsync(x => x.TenantId == tenantId && x.StoreId == request.StoreId && x.BatchClientOperationId == request.BatchClientOperationId, ct)
                .ConfigureAwait(false);
            if (!string.Equals(replay.RequestHash, requestHash, StringComparison.Ordinal))
            {
                throw new InventoryAdjustmentConflictException("IDEMPOTENCY_CONFLICT", "batchClientOperationId was already used with a different payload.");
            }

            return JsonSerializer.Deserialize<InventoryAdjustmentV2BatchResultDto>(replay.ResultJson)!;
        }

        return result;
    }

    public async Task<CatalogInventoryItemDto> UpsertCatalogInventoryAsync(UpsertCatalogInventoryRequest request, CancellationToken ct)
    {
        var tenantId = RequireTenantId();
        await EnsureStoreBelongsToTenantAsync(request.StoreId, tenantId, ct).ConfigureAwait(false);
        var itemType = ParseInventoryTrackableItemType(request.ItemType);
        _ = await EnsureInventoryItemTrackableAsync(itemType, request.ItemId, ct).ConfigureAwait(false);

        var now = DateTimeOffset.UtcNow;
        var row = await _db.CatalogInventoryBalances.SingleOrDefaultAsync(x => x.StoreId == request.StoreId && x.ItemType == itemType && x.ItemId == request.ItemId, ct).ConfigureAwait(false);
        var previousQty = row?.OnHandQty ?? 0m;
        if (request.OnHandQty < 0m)
        {
            throw new InventoryAdjustmentConflictException("NEGATIVE_STOCK", "Inventory quantity cannot be negative.");
        }

        if (row is null)
        {
            row = new CatalogInventoryBalance { Id = Guid.NewGuid(), TenantId = tenantId, StoreId = request.StoreId, ItemType = itemType, ItemId = request.ItemId, OnHandQty = request.OnHandQty, UpdatedAtUtc = now };
            _db.CatalogInventoryBalances.Add(row);
        }
        else
        {
            row.OnHandQty = request.OnHandQty;
            row.UpdatedAtUtc = now;
        }

        var userId = GetCurrentUserId();
        _db.CatalogInventoryAdjustments.Add(new CatalogInventoryAdjustment
        {
            Id = Guid.NewGuid(), TenantId = tenantId, StoreId = request.StoreId, ItemType = itemType, ItemId = request.ItemId,
            QtyBefore = previousQty, DeltaQty = request.OnHandQty - previousQty, ResultingOnHandQty = request.OnHandQty,
            Reason = request.Reason ?? "SetOnHand", Reference = request.Reference, CreatedAtUtc = now, CreatedByUserId = userId
        });

        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
        await AuditAsync("CatalogInventoryBalance", AuditActions.SetInventoryBalance, row.Id, new { StoreId = request.StoreId, ItemType = itemType.ToString(), ItemId = request.ItemId, QtyBefore = previousQty }, new { QtyAfter = request.OnHandQty }, ct).ConfigureAwait(false);
        return new CatalogInventoryItemDto(row.StoreId, row.ItemType.ToString(), row.ItemId, row.OnHandQty, row.UpdatedAtUtc);
    }

    public async Task<CatalogInventoryAdjustmentDto> CreateCatalogInventoryAdjustmentAsync(CreateCatalogInventoryAdjustmentRequest request, CancellationToken ct)
    {
        var tenantId = RequireTenantId();
        await EnsureStoreBelongsToTenantAsync(request.StoreId, tenantId, ct).ConfigureAwait(false);
        var itemType = ParseInventoryTrackableItemType(request.ItemType);
        var itemDetail = await EnsureInventoryItemTrackableAsync(itemType, request.ItemId, ct).ConfigureAwait(false);
        if (request.QuantityDelta == 0m)
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["quantityDelta"] = ["quantityDelta must be different from zero."] });
        }

        if (!Enum.TryParse<InventoryAdjustmentReason>(request.Reason, true, out _))
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["reason"] = ["reason is invalid."] });
        }

        var now = DateTimeOffset.UtcNow;
        var userId = GetCurrentUserId();

        var row = await _db.CatalogInventoryBalances.SingleOrDefaultAsync(x => x.StoreId == request.StoreId && x.TenantId == tenantId && x.ItemType == itemType && x.ItemId == request.ItemId, ct).ConfigureAwait(false);
        var qtyBefore = row?.OnHandQty ?? 0m;
        var qtyAfter = qtyBefore + request.QuantityDelta;
        if (qtyAfter < 0m)
        {
            throw new InventoryAdjustmentConflictException("NEGATIVE_STOCK", "Resulting stock cannot be negative.");
        }

        if (!string.IsNullOrWhiteSpace(request.ClientOperationId))
        {
            var duplicated = await _db.CatalogInventoryAdjustments.AsNoTracking()
                .Where(x => x.TenantId == tenantId && x.StoreId == request.StoreId && x.ClientOperationId == request.ClientOperationId)
                .OrderByDescending(x => x.CreatedAtUtc)
                .FirstOrDefaultAsync(ct)
                .ConfigureAwait(false);
            if (duplicated is not null)
            {
                return MapAdjustment(duplicated, itemDetail.Name, itemDetail.Sku);
            }
        }

        if (row is null)
        {
            row = new CatalogInventoryBalance
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                StoreId = request.StoreId,
                ItemType = itemType,
                ItemId = request.ItemId,
                OnHandQty = qtyAfter,
                UpdatedAtUtc = now
            };
            _db.CatalogInventoryBalances.Add(row);
        }
        else
        {
            row.OnHandQty = qtyAfter;
            row.UpdatedAtUtc = now;
        }

        var adjustment = new CatalogInventoryAdjustment
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            StoreId = request.StoreId,
            ItemType = itemType,
            ItemId = request.ItemId,
            QtyBefore = qtyBefore,
            DeltaQty = request.QuantityDelta,
            ResultingOnHandQty = qtyAfter,
            Reason = Enum.Parse<InventoryAdjustmentReason>(request.Reason, true).ToString(),
            Reference = request.Reference,
            Note = request.Note,
            ClientOperationId = string.IsNullOrWhiteSpace(request.ClientOperationId) ? null : request.ClientOperationId,
            CreatedAtUtc = now,
            CreatedByUserId = userId
        };

        _db.CatalogInventoryAdjustments.Add(adjustment);
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);

        await AuditAsync(
            "CatalogInventoryAdjustment",
            AuditActions.AdjustInventory,
            adjustment.Id,
            new { request.StoreId, ItemType = itemType.ToString(), request.ItemId, QtyBefore = qtyBefore },
            new { QtyDelta = request.QuantityDelta, QtyAfter = qtyAfter, adjustment.Reason, request.Reference, request.Note, adjustment.CreatedByUserId },
            ct).ConfigureAwait(false);

        return MapAdjustment(adjustment, itemDetail.Name, itemDetail.Sku);
    }

    public async Task<IReadOnlyList<CatalogInventoryAdjustmentDto>> GetCatalogInventoryAdjustmentsAsync(Guid storeId, string? itemType, Guid? itemId, DateTimeOffset? fromUtc, DateTimeOffset? toUtc, CancellationToken ct)
    {
        var tenantId = RequireTenantId();
        await EnsureStoreBelongsToTenantAsync(storeId, tenantId, ct).ConfigureAwait(false);

        CatalogItemType? parsedType = null;
        if (!string.IsNullOrWhiteSpace(itemType))
        {
            parsedType = ParseInventoryTrackableItemType(itemType);
        }

        var query = _db.CatalogInventoryAdjustments.AsNoTracking().Where(x => x.TenantId == tenantId && x.StoreId == storeId);
        if (parsedType.HasValue)
        {
            query = query.Where(x => x.ItemType == parsedType.Value);
        }
        if (itemId.HasValue)
        {
            query = query.Where(x => x.ItemId == itemId.Value);
        }
        if (fromUtc.HasValue)
        {
            query = query.Where(x => x.CreatedAtUtc >= fromUtc.Value);
        }
        if (toUtc.HasValue)
        {
            query = query.Where(x => x.CreatedAtUtc <= toUtc.Value);
        }

        var rows = await query.OrderByDescending(x => x.CreatedAtUtc).ToListAsync(ct).ConfigureAwait(false);
        var catalogTemplateId = await GetTenantCatalogTemplateIdAsync(ct).ConfigureAwait(false);
        var itemLookup = await BuildTemplateItemLookupAsync(catalogTemplateId, ct).ConfigureAwait(false);

        return rows.Select(x =>
        {
            var has = itemLookup.TryGetValue((x.ItemType, x.ItemId), out var detail);
            Guid? referenceId = null;
            if (Guid.TryParse(x.ReferenceId, out var parsedReferenceId))
            {
                referenceId = parsedReferenceId;
            }

            return new CatalogInventoryAdjustmentDto(x.Id, x.StoreId, x.ItemType.ToString(), x.ItemId, x.QtyBefore, x.DeltaQty, x.ResultingOnHandQty, x.Reason, x.Reference, x.Note, x.ClientOperationId, x.CreatedAtUtc, x.CreatedByUserId, has ? detail!.ItemName : null, has ? detail!.ItemSku : null, x.ReferenceType, referenceId, x.MovementKind);
        }).ToList();
    }

    public async Task<IReadOnlyList<StoreInventoryItemDto>> GetInventoryAsync(Guid storeId, string? search, bool onlyWithStock, CancellationToken ct)
    {
        var tenantId = RequireTenantId();
        await EnsureStoreBelongsToTenantAsync(storeId, tenantId, ct).ConfigureAwait(false);

        var mapping = await _db.TenantCatalogTemplates.AsNoTracking().SingleAsync(x => x.TenantId == tenantId, ct).ConfigureAwait(false);
        var disabledProducts = await _db.TenantCatalogOverrides.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.ItemType == CatalogItemType.Product && !x.IsEnabled)
            .Select(x => x.ItemId)
            .ToHashSetAsync(ct)
            .ConfigureAwait(false);

        var query = from product in _db.Products.AsNoTracking()
                    where product.CatalogTemplateId == mapping.CatalogTemplateId && product.IsActive && !disabledProducts.Contains(product.Id)
                    join inventory in _db.StoreInventories.AsNoTracking().Where(x => x.StoreId == storeId)
                        on product.Id equals inventory.ProductId into inventoryRows
                    from inventory in inventoryRows.DefaultIfEmpty()
                    select new { product, inventory };

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(x => x.product.Name.Contains(term) || (x.product.ExternalCode != null && x.product.ExternalCode.Contains(term)));
        }

        if (onlyWithStock)
        {
            query = query.Where(x => (x.inventory != null ? x.inventory.OnHand : 0m) > 0m);
        }

        var rows = await query
            .OrderBy(x => x.product.Name)
            .Select(x => new StoreInventoryItemDto(
                storeId,
                x.product.Id,
                x.product.Name,
                x.product.ExternalCode,
                x.inventory != null ? x.inventory.OnHand : 0m,
                x.inventory != null ? x.inventory.Reserved : 0m,
                x.inventory != null ? x.inventory.UpdatedAtUtc : null,
                x.inventory != null))
            .ToListAsync(ct)
            .ConfigureAwait(false);

        return rows;
    }

    public async Task<StoreInventoryItemDto> UpsertInventoryAsync(UpsertStoreInventoryRequest request, CancellationToken ct)
    {
        if (request.OnHand < 0m)
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["onHand"] = ["onHand must be greater or equal to zero."] });
        }

        var tenantId = RequireTenantId();
        await EnsureStoreBelongsToTenantAsync(request.StoreId, tenantId, ct).ConfigureAwait(false);

        var mapping = await _db.TenantCatalogTemplates.AsNoTracking().SingleAsync(x => x.TenantId == tenantId, ct).ConfigureAwait(false);
        var product = await _db.Products.AsNoTracking()
            .Where(x => x.Id == request.ProductId && x.CatalogTemplateId == mapping.CatalogTemplateId)
            .Select(x => new { x.Id, x.Name, x.ExternalCode })
            .SingleOrDefaultAsync(ct)
            .ConfigureAwait(false) ?? throw new NotFoundException("Product was not found for tenant catalog template.");

        Guid? userId = null;
        var now = DateTimeOffset.UtcNow;
        var row = await _db.StoreInventories.FindAsync([request.StoreId, request.ProductId], ct).ConfigureAwait(false);
        if (row is null)
        {
            row = new StoreInventory
            {
                StoreId = request.StoreId,
                ProductId = request.ProductId,
                OnHand = request.OnHand,
                Reserved = 0m,
                UpdatedAtUtc = now,
                UpdatedByUserId = userId
            };
            _db.StoreInventories.Add(row);
        }
        else
        {
            row.OnHand = request.OnHand;
            row.UpdatedAtUtc = now;
            row.UpdatedByUserId = userId;
        }

        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
        return new StoreInventoryItemDto(row.StoreId, row.ProductId, product.Name, product.ExternalCode, row.OnHand, row.Reserved, row.UpdatedAtUtc, true);
    }

    public async Task<PosInventorySettingsDto> UpdateInventorySettingsAsync(UpdatePosInventorySettingsRequest request, CancellationToken ct)
    {
        _ = RequireTenantId();
        var settings = await _db.PosSettings.OrderBy(x => x.Id).FirstAsync(ct).ConfigureAwait(false);
        settings.ShowOnlyInStock = request.ShowOnlyInStock;
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
        return new PosInventorySettingsDto(settings.ShowOnlyInStock);
    }

    public async Task<CatalogSnapshotDto> GetSnapshotAsync(Guid? storeId, CancellationToken ct)
    {
        var tenantId = RequireTenantId();
        var (resolvedStoreId, settings) = await _storeContext.ResolveStoreAsync(storeId, ct).ConfigureAwait(false);
        var tenant = await _db.Tenants.AsNoTracking().SingleAsync(x => x.Id == tenantId, ct).ConfigureAwait(false);
        var mapping = await _db.TenantCatalogTemplates.AsNoTracking().SingleAsync(x => x.TenantId == tenantId, ct).ConfigureAwait(false);

        if (!mapping.CatalogTemplateId.HasValue)
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["catalogTemplateId"] = ["Tenant catalog template is not configured."] });
        }

        var tenantDisabled = await _db.TenantCatalogOverrides.AsNoTracking()
            .Where(x => x.TenantId == tenantId && !x.IsEnabled)
            .Select(x => new { x.ItemType, x.ItemId })
            .ToHashSetAsync(ct)
            .ConfigureAwait(false);

        var storeOverrides = await _db.StoreCatalogOverrides.AsNoTracking()
            .Where(x => x.StoreId == resolvedStoreId && x.TenantId == tenantId)
            .ToDictionaryAsync(x => (x.ItemType, x.ItemId), x => (CatalogOverrideState?)x.OverrideState, ct)
            .ConfigureAwait(false);

        var inventoryByItem = await _db.CatalogInventoryBalances.AsNoTracking()
            .Where(x => x.StoreId == resolvedStoreId && x.TenantId == tenantId)
            .ToDictionaryAsync(x => (x.ItemType, x.ItemId), x => x.OnHandQty, ct)
            .ConfigureAwait(false);

        var categories = await _db.Categories.AsNoTracking()
            .Where(x => x.IsActive && x.CatalogTemplateId == mapping.CatalogTemplateId)
            .OrderBy(x => x.SortOrder)
            .Select(x => new CategoryDto(x.Id, x.Name, x.SortOrder, x.IsActive))
            .ToListAsync(ct).ConfigureAwait(false);

        // --- Productos: primero traemos los datos necesarios desde la BD ---
        var productEntities = await _db.Products.AsNoTracking()
            .Where(x => x.IsActive && x.CatalogTemplateId == mapping.CatalogTemplateId)
            .Select(x => new
            {
                x.Id,
                x.ExternalCode,
                x.Name,
                x.CategoryId,
                x.SubcategoryName,
                x.BasePrice,
                x.IsActive,
                x.IsAvailable,
                x.CustomizationSchemaId,
                x.IsInventoryTracked
            })
            .ToListAsync(ct).ConfigureAwait(false);

        var productCandidates = productEntities.Select(x => new ProductDto(
            x.Id,
            x.ExternalCode,
            x.Name,
            x.CategoryId,
            x.SubcategoryName,
            x.BasePrice,
            x.IsActive,
            PosAvailabilityEngine.Resolve(new PosAvailabilityEngine.Input(
                CatalogItemType.Product,
                x.Id,
                !tenantDisabled.Contains(new { ItemType = CatalogItemType.Product, ItemId = x.Id }),
                storeOverrides.GetValueOrDefault((CatalogItemType.Product, x.Id)),
                x.IsAvailable,
                x.IsInventoryTracked,
                inventoryByItem.GetValueOrDefault((CatalogItemType.Product, x.Id), 0m))).IsAvailableEffective,
            x.CustomizationSchemaId,
            x.IsInventoryTracked,
            inventoryByItem.GetValueOrDefault((CatalogItemType.Product, x.Id), 0m),
            PosAvailabilityEngine.Resolve(new PosAvailabilityEngine.Input(CatalogItemType.Product, x.Id, !tenantDisabled.Contains(new { ItemType = CatalogItemType.Product, ItemId = x.Id }), storeOverrides.GetValueOrDefault((CatalogItemType.Product, x.Id)), x.IsAvailable, x.IsInventoryTracked, inventoryByItem.GetValueOrDefault((CatalogItemType.Product, x.Id), 0m))).Reason,
            storeOverrides.GetValueOrDefault((CatalogItemType.Product, x.Id))?.ToString()
        )).ToList();

        // Filtro por stock según configuración
        var products = settings.ShowOnlyInStock
            ? productCandidates.Where(x => x.IsAvailable).ToList()
            : productCandidates;

        // --- OptionSets (no dependen de availability, se mantiene igual) ---
        var optionSets = await _db.OptionSets.AsNoTracking()
            .Where(x => x.IsActive && x.CatalogTemplateId == mapping.CatalogTemplateId)
            .Select(x => new OptionSetDto(x.Id, x.Name, x.IsActive))
            .ToListAsync(ct).ConfigureAwait(false);

        // --- OptionItems ---
        var optionItemEntities = await _db.OptionItems.AsNoTracking()
            .Where(x => x.IsActive && x.CatalogTemplateId == mapping.CatalogTemplateId)
            .Select(x => new
            {
                x.Id,
                x.OptionSetId,
                x.Name,
                x.IsActive,
                x.IsAvailable,
                x.SortOrder
            })
            .ToListAsync(ct).ConfigureAwait(false);

        var optionItems = optionItemEntities.Select(x =>
        {
            var resolved = PosAvailabilityEngine.Resolve(new PosAvailabilityEngine.Input(
                CatalogItemType.OptionItem,
                x.Id,
                !tenantDisabled.Contains(new { ItemType = CatalogItemType.OptionItem, ItemId = x.Id }),
                storeOverrides.GetValueOrDefault((CatalogItemType.OptionItem, x.Id)),
                x.IsAvailable,
                false,
                null));

            return new OptionItemDto(x.Id, x.OptionSetId, x.Name, x.IsActive, resolved.IsAvailableEffective, x.SortOrder, resolved.Reason, resolved.StoreOverrideState?.ToString());
        }).ToList();

        // --- Schemas (sin cambios) ---
        var schemas = await _db.CustomizationSchemas.AsNoTracking()
            .Where(x => x.IsActive && x.CatalogTemplateId == mapping.CatalogTemplateId)
            .Select(x => new SchemaDto(x.Id, x.Name, x.IsActive))
            .ToListAsync(ct).ConfigureAwait(false);

        // --- Groups (sin cambios) ---
        var groups = await _db.SelectionGroups.AsNoTracking()
            .Where(x => x.IsActive && x.CatalogTemplateId == mapping.CatalogTemplateId)
            .Select(x => Map(x))
            .ToListAsync(ct).ConfigureAwait(false);

        // --- Extras ---
        var extraEntities = await _db.Extras.AsNoTracking()
            .Where(x => x.IsActive && x.CatalogTemplateId == mapping.CatalogTemplateId)
            .Select(x => new
            {
                x.Id,
                x.Name,
                x.Price,
                x.IsActive,
                x.IsAvailable,
                x.IsInventoryTracked
            })
            .ToListAsync(ct).ConfigureAwait(false);

        var extras = extraEntities.Select(x =>
        {
            var stock = inventoryByItem.GetValueOrDefault((CatalogItemType.Extra, x.Id), 0m);
            var resolved = PosAvailabilityEngine.Resolve(new PosAvailabilityEngine.Input(
                CatalogItemType.Extra,
                x.Id,
                !tenantDisabled.Contains(new { ItemType = CatalogItemType.Extra, ItemId = x.Id }),
                storeOverrides.GetValueOrDefault((CatalogItemType.Extra, x.Id)),
                x.IsAvailable,
                x.IsInventoryTracked,
                stock));
            return new ExtraDto(x.Id, x.Name, x.Price, x.IsActive, resolved.IsAvailableEffective, x.IsInventoryTracked, stock, resolved.Reason, resolved.StoreOverrideState?.ToString());
        }).ToList();

        // --- IncludedItems (depende de las listas ya en memoria, pero EF puede traducir el Contains a SQL) ---
        var included = await _db.IncludedItems.AsNoTracking()
            .Where(x => products.Select(p => p.Id).Contains(x.ProductId) && extras.Select(e => e.Id).Contains(x.ExtraId))
            .Select(x => new IncludedItemDto(x.Id, x.ProductId, x.ExtraId, x.Quantity))
            .ToListAsync(ct).ConfigureAwait(false);

        // --- Overrides (sin cambios) ---
        var pgOverrides = await _db.ProductGroupOverrides.AsNoTracking()
            .Where(x => x.IsActive)
            .ToListAsync(ct).ConfigureAwait(false);
        var allowed = await _db.ProductGroupOverrideAllowedItems.AsNoTracking()
            .ToListAsync(ct).ConfigureAwait(false);
        var overrideDtos = pgOverrides.Select(o => new ProductOverrideDto(
            o.Id, o.ProductId, o.GroupKey, o.IsActive,
            allowed.Where(a => a.ProductGroupOverrideId == o.Id).Select(a => a.OptionItemId).ToList()
        )).ToList();

        var stamp = ComputeVersionStamp(categories.Count, products.Count, optionItems.Count, extras.Count);
        var etagSeed = ComputeWeakEtag(stamp, tenantId, mapping.CatalogTemplateId.Value, resolvedStoreId);
        var timeZoneId = await _db.Stores.AsNoTracking()
            .Where(x => x.Id == resolvedStoreId)
            .Select(x => x.TimeZoneId)
            .SingleAsync(ct).ConfigureAwait(false);

        return new CatalogSnapshotDto(
            tenantId, tenant.VerticalId, mapping.CatalogTemplateId.Value, resolvedStoreId, timeZoneId,
            DateTimeOffset.UtcNow, stamp, etagSeed,
            categories, products, optionSets, optionItems, schemas, groups, extras, included, overrideDtos, stamp
        );
    }

    public async Task<string> ComputeCatalogEtagAsync(Guid? storeId, CancellationToken ct)
    {
        var tenantId = RequireTenantId();
        var (resolvedStoreId, _) = await _storeContext.ResolveStoreAsync(storeId, ct).ConfigureAwait(false);
        var mapping = await _db.TenantCatalogTemplates.AsNoTracking().SingleAsync(x => x.TenantId == tenantId, ct).ConfigureAwait(false);
        var stamp = await ComputeVersionStampFromDataAsync(tenantId, resolvedStoreId, mapping.CatalogTemplateId ?? Guid.Empty, ct).ConfigureAwait(false);
        var sections = new[] { stamp, resolvedStoreId.ToString("N"), (mapping.CatalogTemplateId ?? Guid.Empty).ToString("N") };
        var etagSeed = string.Join('\n', sections);
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(etagSeed));
        return $"W/\"{Convert.ToHexString(bytes)}\"";
    }

    private async Task<string> ComputeVersionStampFromDataAsync(Guid tenantId, Guid storeId, Guid catalogTemplateId, CancellationToken ct)
    {
        var categoryStamp = await _db.Categories.AsNoTracking().Where(x => x.CatalogTemplateId == catalogTemplateId).Select(x => x.UpdatedAtUtc).DefaultIfEmpty().MaxAsync(ct).ConfigureAwait(false);
        var productStamp = await _db.Products.AsNoTracking().Where(x => x.CatalogTemplateId == catalogTemplateId).Select(x => x.UpdatedAtUtc).DefaultIfEmpty().MaxAsync(ct).ConfigureAwait(false);
        var optionItemStamp = await _db.OptionItems.AsNoTracking().Where(x => x.CatalogTemplateId == catalogTemplateId).Select(x => x.UpdatedAtUtc).DefaultIfEmpty().MaxAsync(ct).ConfigureAwait(false);
        var extraStamp = await _db.Extras.AsNoTracking().Where(x => x.CatalogTemplateId == catalogTemplateId).Select(x => x.UpdatedAtUtc).DefaultIfEmpty().MaxAsync(ct).ConfigureAwait(false);
        var tenantOverrideStamp = await _db.TenantCatalogOverrides.AsNoTracking().Where(x => x.TenantId == tenantId).Select(x => x.UpdatedAtUtc).DefaultIfEmpty().MaxAsync(ct).ConfigureAwait(false);
        var storeOverrideStamp = await _db.StoreCatalogOverrides.AsNoTracking().Where(x => x.StoreId == storeId && x.TenantId == tenantId).Select(x => x.UpdatedAtUtc).DefaultIfEmpty().MaxAsync(ct).ConfigureAwait(false);
        var inventoryStamp = await _db.CatalogInventoryBalances.AsNoTracking().Where(x => x.StoreId == storeId && x.TenantId == tenantId).Select(x => x.UpdatedAtUtc).DefaultIfEmpty().MaxAsync(ct).ConfigureAwait(false);
        var settingsStamp = await _db.PosSettings.AsNoTracking().Select(x => x.UpdatedAtUtc).DefaultIfEmpty().MaxAsync(ct).ConfigureAwait(false);

        return string.Join('|', categoryStamp.Ticks, productStamp.Ticks, optionItemStamp.Ticks, extraStamp.Ticks, tenantOverrideStamp.Ticks, storeOverrideStamp.Ticks, inventoryStamp.Ticks, settingsStamp.Ticks);
    }

    private sealed record CatalogItemTemplateDetail(string ItemName, string? ItemSku);

    private async Task<IReadOnlyList<CatalogItemOverrideDto>> MapOverrideRowsAsync(IReadOnlyList<TenantCatalogOverride> rows, Guid catalogTemplateId, CancellationToken ct)
    {
        var itemDetails = await BuildTemplateItemLookupAsync(catalogTemplateId, ct).ConfigureAwait(false);
        return rows.Select(x =>
        {
            itemDetails.TryGetValue((x.ItemType, x.ItemId), out var detail);
            return new CatalogItemOverrideDto(x.ItemType.ToString(), x.ItemId, x.IsEnabled, x.UpdatedAtUtc, detail?.ItemName ?? string.Empty, detail?.ItemSku, catalogTemplateId);
        }).ToList();
    }

    private async Task<Dictionary<(CatalogItemType ItemType, Guid ItemId), CatalogItemTemplateDetail>> BuildTemplateItemLookupAsync(Guid catalogTemplateId, CancellationToken ct)
    {
        var lookup = new Dictionary<(CatalogItemType ItemType, Guid ItemId), CatalogItemTemplateDetail>();

        var products = await _db.Products.AsNoTracking()
            .Where(x => x.CatalogTemplateId == catalogTemplateId)
            .Select(x => new { x.Id, x.Name, x.ExternalCode })
            .ToListAsync(ct)
            .ConfigureAwait(false);
        foreach (var row in products)
        {
            lookup[(CatalogItemType.Product, row.Id)] = new CatalogItemTemplateDetail(row.Name, row.ExternalCode);
        }

        var extras = await _db.Extras.AsNoTracking()
            .Where(x => x.CatalogTemplateId == catalogTemplateId)
            .Select(x => new { x.Id, x.Name })
            .ToListAsync(ct)
            .ConfigureAwait(false);
        foreach (var row in extras)
        {
            lookup[(CatalogItemType.Extra, row.Id)] = new CatalogItemTemplateDetail(row.Name, null);
        }

        var optionItems = await _db.OptionItems.AsNoTracking()
            .Where(x => x.CatalogTemplateId == catalogTemplateId)
            .Select(x => new { x.Id, x.Name })
            .ToListAsync(ct)
            .ConfigureAwait(false);
        foreach (var row in optionItems)
        {
            lookup[(CatalogItemType.OptionItem, row.Id)] = new CatalogItemTemplateDetail(row.Name, null);
        }

        return lookup;
    }

    public Task<IReadOnlyList<InventoryReportRowDto>> GetInventoryCurrentReportAsync(Guid storeId, string? itemType, string? search, CancellationToken ct) =>
        GetInventoryReportRowsAsync(storeId, itemType, search, row => true, ct);

    public Task<IReadOnlyList<InventoryReportRowDto>> GetInventoryLowStockReportAsync(Guid storeId, decimal threshold, string? itemType, string? search, CancellationToken ct)
    {
        if (threshold <= 0m)
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["threshold"] = ["threshold must be greater than zero."] });
        }

        return GetInventoryReportRowsAsync(storeId, itemType, search, row => row.StockOnHandQty > 0m && row.StockOnHandQty <= threshold, ct);
    }

    public Task<IReadOnlyList<InventoryReportRowDto>> GetInventoryOutOfStockReportAsync(Guid storeId, string? itemType, string? search, CancellationToken ct) =>
        GetInventoryReportRowsAsync(storeId, itemType, search, row => row.StockOnHandQty <= 0m, ct);

    private async Task<IReadOnlyList<InventoryReportRowDto>> GetInventoryReportRowsAsync(Guid storeId, string? itemType, string? search, Func<InventoryReportRowDto, bool> filter, CancellationToken ct)
    {
        var tenantId = RequireTenantId();
        await EnsureStoreBelongsToTenantAsync(storeId, tenantId, ct).ConfigureAwait(false);

        CatalogItemType? parsed = null;
        if (!string.IsNullOrWhiteSpace(itemType))
        {
            parsed = ParseInventoryTrackableItemType(itemType);
        }

        var snapshot = await GetSnapshotAsync(storeId, ct).ConfigureAwait(false);
        var products = snapshot.Products
            .Where(x => x.IsInventoryTracked == true)
            .Where(x => !parsed.HasValue || parsed == CatalogItemType.Product)
            .Select(x => new InventoryReportRowDto("Product", x.Id, x.Name, x.ExternalCode, storeId, x.StockOnHandQty ?? 0m, true, x.AvailabilityReason ?? "Available", x.StoreOverrideState, null, null));
        var extras = snapshot.Extras
            .Where(x => x.IsInventoryTracked == true)
            .Where(x => !parsed.HasValue || parsed == CatalogItemType.Extra)
            .Select(x => new InventoryReportRowDto("Extra", x.Id, x.Name, null, storeId, x.StockOnHandQty ?? 0m, true, x.AvailabilityReason ?? "Available", x.StoreOverrideState, null, null));

        var rows = products.Concat(extras).ToList();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            rows = rows.Where(x => x.ItemName.Contains(term, StringComparison.OrdinalIgnoreCase) || (x.ItemSku?.Contains(term, StringComparison.OrdinalIgnoreCase) ?? false)).ToList();
        }

        var updatedByItem = await _db.CatalogInventoryBalances.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.StoreId == storeId)
            .ToDictionaryAsync(x => (x.ItemType.ToString(), x.ItemId), x => x.UpdatedAtUtc, ct)
            .ConfigureAwait(false);

        var adjustmentsByItem = await _db.CatalogInventoryAdjustments.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.StoreId == storeId)
            .GroupBy(x => new { x.ItemType, x.ItemId })
            .Select(x => new { x.Key.ItemType, x.Key.ItemId, LastAdjustmentAtUtc = x.Max(y => y.CreatedAtUtc) })
            .ToDictionaryAsync(x => (x.ItemType.ToString(), x.ItemId), x => (DateTimeOffset?)x.LastAdjustmentAtUtc, ct)
            .ConfigureAwait(false);

        return rows
            .Select(x => x with
            {
                UpdatedAtUtc = updatedByItem.GetValueOrDefault((x.ItemType, x.ItemId)),
                LastAdjustmentAtUtc = adjustmentsByItem.GetValueOrDefault((x.ItemType, x.ItemId))
            })
            .Where(filter)
            .OrderBy(x => x.ItemType)
            .ThenBy(x => x.ItemName)
            .ToList();
    }

    private static CatalogInventoryAdjustmentDto MapAdjustment(CatalogInventoryAdjustment adjustment, string? itemName, string? itemSku) =>
        new(adjustment.Id, adjustment.StoreId, adjustment.ItemType.ToString(), adjustment.ItemId, adjustment.QtyBefore, adjustment.DeltaQty, adjustment.ResultingOnHandQty, adjustment.Reason, adjustment.Reference, adjustment.Note, adjustment.ClientOperationId, adjustment.CreatedAtUtc, adjustment.CreatedByUserId, itemName, itemSku, adjustment.ReferenceType, Guid.TryParse(adjustment.ReferenceId, out var referenceId) ? referenceId : null, adjustment.MovementKind);

    private static CatalogItemType ParseInventoryTrackableItemType(string itemType)
    {
        if (!Enum.TryParse<CatalogItemType>(itemType, true, out var parsed) || parsed == CatalogItemType.OptionItem)
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["itemType"] = ["itemType must be Product or Extra."] });
        }

        return parsed;
    }

    private async Task<(string Name, string? Sku)> EnsureInventoryItemTrackableAsync(CatalogItemType itemType, Guid itemId, CancellationToken ct)
    {
        var catalogTemplateId = await GetTenantCatalogTemplateIdAsync(ct).ConfigureAwait(false);
        if (itemType == CatalogItemType.Product)
        {
            var product = await _db.Products.AsNoTracking()
                .Where(x => x.Id == itemId && x.CatalogTemplateId == catalogTemplateId)
                .Select(x => new { x.Name, x.ExternalCode, x.IsInventoryTracked })
                .SingleOrDefaultAsync(ct)
                .ConfigureAwait(false);
            if (product is null)
            {
                throw new ValidationException(new Dictionary<string, string[]> { ["itemId"] = ["Product not found in tenant catalog template."] });
            }

            if (!product.IsInventoryTracked)
            {
                throw new InventoryAdjustmentConflictException("NOT_TRACKED", "Item inventory tracking is disabled.");
            }

            return (product.Name, product.ExternalCode);
        }

        if (itemType == CatalogItemType.Extra)
        {
            var extra = await _db.Extras.AsNoTracking()
                .Where(x => x.Id == itemId && x.CatalogTemplateId == catalogTemplateId)
                .Select(x => new { x.Name, x.IsInventoryTracked })
                .SingleOrDefaultAsync(ct)
                .ConfigureAwait(false);
            if (extra is null)
            {
                throw new ValidationException(new Dictionary<string, string[]> { ["itemId"] = ["Extra not found in tenant catalog template."] });
            }

            if (!extra.IsInventoryTracked)
            {
                throw new InventoryAdjustmentConflictException("NOT_TRACKED", "Item inventory tracking is disabled.");
            }

            return (extra.Name, null);
        }

        throw new ValidationException(new Dictionary<string, string[]> { ["itemType"] = ["itemType must be Product or Extra."] });
    }

    private static Guid DeriveLineClientOperationId(Guid batchClientOperationId, int lineNo)
    {
        var input = Encoding.UTF8.GetBytes($"{batchClientOperationId:D}:{lineNo}");
        var hash = SHA256.HashData(input);
        Span<byte> bytes = stackalloc byte[16];
        hash[..16].CopyTo(bytes);
        return new Guid(bytes);
    }

    private static string ComputeBatchRequestHash(CreateInventoryAdjustmentV2BatchRequest request)
    {
        var normalized = new
        {
            request.StoreId,
            ReasonCode = request.ReasonCode.Trim(),
            request.ReferenceType,
            request.ReferenceId,
            request.Note,
            request.BatchClientOperationId,
            Lines = request.Lines.OrderBy(x => x.LineNo).Select(x => new
            {
                x.LineNo,
                ItemType = x.ItemType?.Trim(),
                x.ExternalCode,
                x.ItemId,
                DeltaQty = decimal.Round(x.DeltaQty, 3, MidpointRounding.AwayFromZero),
                x.LineClientOperationId
            }).ToArray()
        };
        var json = JsonSerializer.Serialize(normalized);
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(json));
        return Convert.ToHexString(hash);
    }

    private Guid? GetCurrentUserId()
    {
        var raw = _httpContextAccessor.HttpContext?.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(raw, out var parsed) ? parsed : null;
    }

    private static ProductDto Map(Product x) => new(x.Id, x.ExternalCode, x.Name, x.CategoryId, x.SubcategoryName, x.BasePrice, x.IsActive, x.IsAvailable, x.CustomizationSchemaId, x.IsInventoryTracked);
    private static SelectionGroupDto Map(SelectionGroup x) => new(x.Id, x.SchemaId, x.Key, x.Label, x.SelectionMode, x.MinSelections, x.MaxSelections, x.OptionSetId, x.IsActive, x.SortOrder);
    private static async Task<T> FindAsync<T>(DbSet<T> set, Guid id, CancellationToken ct) where T : class => await set.FindAsync([id], ct).ConfigureAwait(false) ?? throw new NotFoundException(typeof(T).Name + " not found");
    private async Task EnsureSchemaActiveIfPresent(Guid? schemaId, CancellationToken ct) { if (!schemaId.HasValue) return; var ok = await _db.CustomizationSchemas.AnyAsync(x => x.Id == schemaId && x.IsActive, ct).ConfigureAwait(false); if (!ok) throw new ValidationException(new Dictionary<string, string[]> { { "customizationSchemaId", ["Schema must exist and be active."] } }); }
    private async Task EnsureUniqueGroupKey(Guid schemaId, string key, Guid? ignoreId, CancellationToken ct) { var exists = await _db.SelectionGroups.AnyAsync(x => x.SchemaId == schemaId && x.Key == key && (!ignoreId.HasValue || x.Id != ignoreId.Value), ct).ConfigureAwait(false); if (exists) throw new ConflictException("SelectionGroup key already exists."); }
    private async Task<ProductOverrideDto> BuildOverrideDto(ProductGroupOverride o, CancellationToken ct) { var ids = await _db.ProductGroupOverrideAllowedItems.AsNoTracking().Where(x => x.ProductGroupOverrideId == o.Id).Select(x => x.OptionItemId).ToListAsync(ct).ConfigureAwait(false); return new(o.Id, o.ProductId, o.GroupKey, o.IsActive, ids); }
    private async Task AuditAsync(string entity, string action, Guid entityId, object? before, object? after, CancellationToken ct) { await _auditLogger.LogAsync(new AuditEntry(action, null, null, entity, entityId.ToString(), before, after, "Api", null, DateTime.UtcNow), ct).ConfigureAwait(false); PosCatalogLog.AuditWritten(_logger, action, entity, entityId); }
    private Guid RequireTenantId() => _tenantContext.EffectiveTenantId ?? throw new ForbiddenException("Tenant context is required.");

    private async Task<Guid> GetTenantCatalogTemplateIdAsync(CancellationToken ct)
    {
        var tenantId = RequireTenantId();
        var mapping = await _db.TenantCatalogTemplates
            .AsNoTracking()
            .SingleAsync(x => x.TenantId == tenantId, ct)
            .ConfigureAwait(false);

        if (!mapping.CatalogTemplateId.HasValue)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["catalogTemplateId"] = ["Tenant catalog template is not configured."]
            });
        }

        return mapping.CatalogTemplateId.Value;
    }

    private async Task EnsureStoreBelongsToTenantAsync(Guid storeId, Guid tenantId, CancellationToken ct)
    {
        var storeBelongs = await _db.Stores.AsNoTracking().AnyAsync(x => x.Id == storeId && x.TenantId == tenantId, ct).ConfigureAwait(false);
        if (!storeBelongs)
        {
            throw new ForbiddenException("Store does not belong to tenant.");
        }
    }

    private static string ComputeWeakEtag(string stamp, Guid tenantId, Guid templateId, Guid storeId)
    {
        var input = $"{stamp}|{tenantId:N}|{templateId:N}|{storeId:N}";
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return $"W/\"{Convert.ToHexString(bytes)}\"";
    }

    private static string ComputeVersionStamp(params object[] sections)
    {
        var input = string.Join('|', sections.Select(x => x.ToString()));
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes);
    }
}


internal static partial class PosCatalogLog
{
    private static readonly Action<ILogger, string, string, Guid, Exception?> AuditWrittenMessage =
        LoggerMessage.Define<string, string, Guid>(
            LogLevel.Information,
            new EventId(1, nameof(AuditWritten)),
            "audit_log_written action={Action} entity={Entity} entityId={EntityId}");

    public static void AuditWritten(ILogger logger, string action, string entity, Guid entityId)
    {
        AuditWrittenMessage(logger, action, entity, entityId, null);
    }

    [LoggerMessage(
        EventId = 2,
        Level = LogLevel.Warning,
        Message = "Inventory movement anomaly detected. Tenant={TenantId} Store={StoreId} ItemType={ItemType} ItemId={ItemId} MovementId={MovementId} QtyBefore={QtyBefore} Delta={DeltaQty} QtyAfter={QtyAfter}")]
    public static partial void InventoryMovementAnomalyDetected(
        ILogger logger,
        Guid tenantId,
        Guid storeId,
        CatalogItemType itemType,
        Guid itemId,
        Guid movementId,
        decimal qtyBefore,
        decimal deltaQty,
        decimal qtyAfter);

    [LoggerMessage(
        EventId = 3,
        Level = LogLevel.Information,
        Message = "Inventory batch adjustment processed. Tenant={TenantId} Store={StoreId} BatchClientOperationId={BatchClientOperationId} Applied={AppliedCount} Failed={FailedCount}")]
    public static partial void InventoryBatchAdjustmentProcessed(
        ILogger logger,
        Guid tenantId,
        Guid storeId,
        Guid batchClientOperationId,
        int appliedCount,
        int failedCount);
}
