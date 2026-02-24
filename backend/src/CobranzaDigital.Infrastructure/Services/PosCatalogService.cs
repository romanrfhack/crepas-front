using System.Security.Cryptography;
using System.Text;

using CobranzaDigital.Application.Auditing;
using CobranzaDigital.Application.Common.Exceptions;
using CobranzaDigital.Application.Contracts.PosCatalog;
using CobranzaDigital.Application.Interfaces;
using CobranzaDigital.Application.Interfaces.PosCatalog;
using CobranzaDigital.Application.Validators.PosCatalog;
using CobranzaDigital.Domain.Entities;
using CobranzaDigital.Infrastructure.Persistence;

using FluentValidation;

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

    public PosCatalogService(CobranzaDigitalDbContext db, IAuditLogger auditLogger, ILogger<PosCatalogService> logger,
        IValidator<UpsertSelectionGroupRequest> groupValidator,
        IValidator<UpsertProductRequest> productValidator,
        IValidator<UpsertExtraRequest> extraValidator,
        IValidator<ReplaceIncludedItemsRequest> includedValidator,
        IValidator<OverrideUpsertRequest> overrideValidator,
        PosStoreContextService storeContext,
        ITenantContext tenantContext)
    { _db = db; _auditLogger = auditLogger; _logger = logger; _groupValidator = groupValidator; _productValidator = productValidator; _extraValidator = extraValidator; _includedValidator = includedValidator; _overrideValidator = overrideValidator; _storeContext = storeContext; _tenantContext = tenantContext; }

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

    public async Task<CatalogInventoryItemDto> UpsertCatalogInventoryAsync(UpsertCatalogInventoryRequest request, CancellationToken ct)
    {
        var tenantId = RequireTenantId();
        await EnsureStoreBelongsToTenantAsync(request.StoreId, tenantId, ct).ConfigureAwait(false);
        if (!Enum.TryParse<CatalogItemType>(request.ItemType, true, out var itemType) || itemType == CatalogItemType.OptionItem)
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["itemType"] = ["itemType must be Product or Extra."] });
        }

        var now = DateTimeOffset.UtcNow;
        var row = await _db.CatalogInventoryBalances.SingleOrDefaultAsync(x => x.StoreId == request.StoreId && x.ItemType == itemType && x.ItemId == request.ItemId, ct).ConfigureAwait(false);
        var previousQty = row?.OnHandQty ?? 0m;
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

        _db.CatalogInventoryAdjustments.Add(new CatalogInventoryAdjustment
        {
            Id = Guid.NewGuid(), TenantId = tenantId, StoreId = request.StoreId, ItemType = itemType, ItemId = request.ItemId,
            DeltaQty = request.OnHandQty - previousQty, ResultingOnHandQty = request.OnHandQty,
            Reason = request.Reason ?? "SetOnHand", Reference = request.Reference, CreatedAtUtc = now
        });

        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
        return new CatalogInventoryItemDto(row.StoreId, row.ItemType.ToString(), row.ItemId, row.OnHandQty, row.UpdatedAtUtc);
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

        var disabledProducts = await _db.TenantCatalogOverrides.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.ItemType == CatalogItemType.Product && !x.IsEnabled)
            .Select(x => x.ItemId).ToHashSetAsync(ct).ConfigureAwait(false);
        var disabledExtras = await _db.TenantCatalogOverrides.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.ItemType == CatalogItemType.Extra && !x.IsEnabled)
            .Select(x => x.ItemId).ToHashSetAsync(ct).ConfigureAwait(false);
        var disabledOptionItems = await _db.TenantCatalogOverrides.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.ItemType == CatalogItemType.OptionItem && !x.IsEnabled)
            .Select(x => x.ItemId).ToHashSetAsync(ct).ConfigureAwait(false);

        var availability = await _db.StoreCatalogAvailabilities.AsNoTracking()
            .Where(x => x.StoreId == resolvedStoreId)
            .ToDictionaryAsync(x => (x.ItemType, x.ItemId), x => x.IsAvailable, ct)
            .ConfigureAwait(false);

        var categories = await _db.Categories.AsNoTracking()
            .Where(x => x.IsActive && x.CatalogTemplateId == mapping.CatalogTemplateId)
            .OrderBy(x => x.SortOrder)
            .Select(x => new CategoryDto(x.Id, x.Name, x.SortOrder, x.IsActive))
            .ToListAsync(ct).ConfigureAwait(false);

        // --- Productos: primero traemos los datos necesarios desde la BD ---
        var productEntities = await _db.Products.AsNoTracking()
            .Where(x => x.IsActive && x.CatalogTemplateId == mapping.CatalogTemplateId && !disabledProducts.Contains(x.Id))
            .Select(x => new
            {
                x.Id,
                x.ExternalCode,
                x.Name,
                x.CategoryId,
                x.SubcategoryName,
                x.BasePrice,
                x.IsActive,
                x.IsAvailable,      // disponibilidad por defecto
                x.CustomizationSchemaId
            })
            .ToListAsync(ct).ConfigureAwait(false);

        // Mapeamos a DTO usando el diccionario de disponibilidad (en memoria)
        var productCandidates = productEntities.Select(x => new ProductDto(
            x.Id,
            x.ExternalCode,
            x.Name,
            x.CategoryId,
            x.SubcategoryName,
            x.BasePrice,
            x.IsActive,
            availability.TryGetValue((CatalogItemType.Product, x.Id), out var available) ? available : x.IsAvailable,
            x.CustomizationSchemaId
        )).ToList();

        // Stock por producto (se mantiene igual)
        var stockByProduct = await _db.StoreInventories.AsNoTracking()
            .Where(x => x.StoreId == resolvedStoreId)
            .ToDictionaryAsync(x => x.ProductId, x => x.OnHand, ct)
            .ConfigureAwait(false);

        // Filtro por stock según configuración
        var products = settings.ShowOnlyInStock
            ? productCandidates.Where(x => x.IsAvailable && stockByProduct.GetValueOrDefault(x.Id, 0m) > 0m).ToList()
            : productCandidates;

        // --- OptionSets (no dependen de availability, se mantiene igual) ---
        var optionSets = await _db.OptionSets.AsNoTracking()
            .Where(x => x.IsActive && x.CatalogTemplateId == mapping.CatalogTemplateId)
            .Select(x => new OptionSetDto(x.Id, x.Name, x.IsActive))
            .ToListAsync(ct).ConfigureAwait(false);

        // --- OptionItems ---
        var optionItemEntities = await _db.OptionItems.AsNoTracking()
            .Where(x => x.IsActive && x.CatalogTemplateId == mapping.CatalogTemplateId && !disabledOptionItems.Contains(x.Id))
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

        var optionItems = optionItemEntities.Select(x => new OptionItemDto(
            x.Id,
            x.OptionSetId,
            x.Name,
            x.IsActive,
            availability.TryGetValue((CatalogItemType.OptionItem, x.Id), out var avail) ? avail : x.IsAvailable,
            x.SortOrder
        )).ToList();

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
            .Where(x => x.IsActive && x.CatalogTemplateId == mapping.CatalogTemplateId && !disabledExtras.Contains(x.Id))
            .Select(x => new
            {
                x.Id,
                x.Name,
                x.Price,
                x.IsActive,
                x.IsAvailable
            })
            .ToListAsync(ct).ConfigureAwait(false);

        var extras = extraEntities.Select(x => new ExtraDto(
            x.Id,
            x.Name,
            x.Price,
            x.IsActive,
            availability.TryGetValue((CatalogItemType.Extra, x.Id), out var avail) ? avail : x.IsAvailable
        )).ToList();

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
        var snapshot = await GetSnapshotAsync(storeId, ct).ConfigureAwait(false);
        var sections = new[] { snapshot.VersionStamp, snapshot.StoreId.ToString("N"), snapshot.CatalogTemplateId.ToString("N") };
        var etagSeed = string.Join('\n', sections);
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(etagSeed));
        return $"W/\"{Convert.ToHexString(bytes)}\"";
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


internal static class PosCatalogLog
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
}
