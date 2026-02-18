using System.Security.Cryptography;
using System.Text;

using CobranzaDigital.Application.Auditing;
using CobranzaDigital.Application.Common.Exceptions;
using CobranzaDigital.Application.Contracts.PosCatalog;
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

    public PosCatalogService(CobranzaDigitalDbContext db, IAuditLogger auditLogger, ILogger<PosCatalogService> logger,
        IValidator<UpsertSelectionGroupRequest> groupValidator,
        IValidator<UpsertProductRequest> productValidator,
        IValidator<UpsertExtraRequest> extraValidator,
        IValidator<ReplaceIncludedItemsRequest> includedValidator,
        IValidator<OverrideUpsertRequest> overrideValidator,
        PosStoreContextService storeContext)
    { _db = db; _auditLogger = auditLogger; _logger = logger; _groupValidator = groupValidator; _productValidator = productValidator; _extraValidator = extraValidator; _includedValidator = includedValidator; _overrideValidator = overrideValidator; _storeContext = storeContext; }

    public async Task<IReadOnlyList<CategoryDto>> GetCategoriesAsync(bool includeInactive, CancellationToken ct) =>
        await _db.Categories.AsNoTracking().Where(x => includeInactive || x.IsActive).OrderBy(x => x.SortOrder).Select(x => new CategoryDto(x.Id, x.Name, x.SortOrder, x.IsActive)).ToListAsync(ct).ConfigureAwait(false);
    public async Task<CategoryDto> CreateCategoryAsync(UpsertCategoryRequest request, CancellationToken ct) { var e = new Category { Id = Guid.NewGuid(), Name = request.Name, SortOrder = request.SortOrder, IsActive = request.IsActive }; _db.Categories.Add(e); await _db.SaveChangesAsync(ct).ConfigureAwait(false); return new(e.Id, e.Name, e.SortOrder, e.IsActive); }
    public async Task<CategoryDto> UpdateCategoryAsync(Guid id, UpsertCategoryRequest request, CancellationToken ct) { var e = await FindAsync(_db.Categories, id, ct).ConfigureAwait(false); var before = new { e.Name, e.SortOrder, e.IsActive }; e.Name = request.Name; e.SortOrder = request.SortOrder; e.IsActive = request.IsActive; await _db.SaveChangesAsync(ct).ConfigureAwait(false); await AuditAsync("Category", "Update", id, before, new { e.Name, e.SortOrder, e.IsActive }, ct).ConfigureAwait(false); return new(e.Id, e.Name, e.SortOrder, e.IsActive); }
    public async Task DeactivateCategoryAsync(Guid id, CancellationToken ct) { var e = await FindAsync(_db.Categories, id, ct).ConfigureAwait(false); var before = new { e.IsActive }; e.IsActive = false; await _db.SaveChangesAsync(ct).ConfigureAwait(false); await AuditAsync("Category", "Deactivate", id, before, new { e.IsActive }, ct).ConfigureAwait(false); }

    public async Task<IReadOnlyList<ProductDto>> GetProductsAsync(bool includeInactive, Guid? categoryId, CancellationToken ct) => await _db.Products.AsNoTracking().Where(x => (includeInactive || x.IsActive) && (!categoryId.HasValue || x.CategoryId == categoryId.Value)).Select(x => Map(x)).ToListAsync(ct).ConfigureAwait(false);
    public async Task<ProductDto> CreateProductAsync(UpsertProductRequest request, CancellationToken ct) { await _productValidator.EnsureValidAsync(request, ct).ConfigureAwait(false); await EnsureSchemaActiveIfPresent(request.CustomizationSchemaId, ct).ConfigureAwait(false); var e = new Product { Id = Guid.NewGuid(), ExternalCode = request.ExternalCode, Name = request.Name, CategoryId = request.CategoryId, SubcategoryName = request.SubcategoryName, BasePrice = request.BasePrice, IsActive = request.IsActive, IsAvailable = request.IsAvailable, CustomizationSchemaId = request.CustomizationSchemaId }; _db.Products.Add(e); await _db.SaveChangesAsync(ct).ConfigureAwait(false); return Map(e); }
    public async Task<ProductDto> UpdateProductAsync(Guid id, UpsertProductRequest request, CancellationToken ct) { await _productValidator.EnsureValidAsync(request, ct).ConfigureAwait(false); await EnsureSchemaActiveIfPresent(request.CustomizationSchemaId, ct).ConfigureAwait(false); var e = await FindAsync(_db.Products, id, ct).ConfigureAwait(false); var before = Map(e); e.ExternalCode = request.ExternalCode; e.Name = request.Name; e.CategoryId = request.CategoryId; e.SubcategoryName = request.SubcategoryName; e.BasePrice = request.BasePrice; e.IsActive = request.IsActive; e.IsAvailable = request.IsAvailable; e.CustomizationSchemaId = request.CustomizationSchemaId; await _db.SaveChangesAsync(ct).ConfigureAwait(false); await AuditAsync("Product", before.IsAvailable != e.IsAvailable ? "UpdateProductAvailability" : "UpdateProduct", id, before, Map(e), ct).ConfigureAwait(false); return Map(e); }
    public async Task DeactivateProductAsync(Guid id, CancellationToken ct) { var e = await FindAsync(_db.Products, id, ct).ConfigureAwait(false); var before = new { e.IsActive }; e.IsActive = false; await _db.SaveChangesAsync(ct).ConfigureAwait(false); await AuditAsync("Product", "Deactivate", id, before, new { e.IsActive }, ct).ConfigureAwait(false); }

    public async Task<IReadOnlyList<OptionSetDto>> GetOptionSetsAsync(bool includeInactive, CancellationToken ct) => await _db.OptionSets.AsNoTracking().Where(x => includeInactive || x.IsActive).Select(x => new OptionSetDto(x.Id, x.Name, x.IsActive)).ToListAsync(ct).ConfigureAwait(false);
    public async Task<OptionSetDto> CreateOptionSetAsync(UpsertOptionSetRequest request, CancellationToken ct) { var e = new OptionSet { Id = Guid.NewGuid(), Name = request.Name, IsActive = request.IsActive }; _db.OptionSets.Add(e); await _db.SaveChangesAsync(ct).ConfigureAwait(false); return new(e.Id, e.Name, e.IsActive); }
    public async Task<OptionSetDto> UpdateOptionSetAsync(Guid id, UpsertOptionSetRequest request, CancellationToken ct) { var e = await FindAsync(_db.OptionSets, id, ct).ConfigureAwait(false); var before = new { e.Name, e.IsActive }; e.Name = request.Name; e.IsActive = request.IsActive; await _db.SaveChangesAsync(ct).ConfigureAwait(false); await AuditAsync("OptionSet", "Update", id, before, new { e.Name, e.IsActive }, ct).ConfigureAwait(false); return new(e.Id, e.Name, e.IsActive); }
    public async Task DeactivateOptionSetAsync(Guid id, CancellationToken ct) { var e = await FindAsync(_db.OptionSets, id, ct).ConfigureAwait(false); e.IsActive = false; await _db.SaveChangesAsync(ct).ConfigureAwait(false); }

    public async Task<IReadOnlyList<OptionItemDto>> GetOptionItemsAsync(Guid optionSetId, bool includeInactive, CancellationToken ct) => await _db.OptionItems.AsNoTracking().Where(x => x.OptionSetId == optionSetId && (includeInactive || x.IsActive)).Select(x => new OptionItemDto(x.Id, x.OptionSetId, x.Name, x.IsActive, x.IsAvailable, x.SortOrder)).ToListAsync(ct).ConfigureAwait(false);
    public async Task<OptionItemDto> CreateOptionItemAsync(Guid optionSetId, UpsertOptionItemRequest request, CancellationToken ct) { var e = new OptionItem { Id = Guid.NewGuid(), OptionSetId = optionSetId, Name = request.Name, IsActive = request.IsActive, IsAvailable = request.IsAvailable, SortOrder = request.SortOrder }; _db.OptionItems.Add(e); await _db.SaveChangesAsync(ct).ConfigureAwait(false); return new(e.Id, e.OptionSetId, e.Name, e.IsActive, e.IsAvailable, e.SortOrder); }
    public async Task<OptionItemDto> UpdateOptionItemAsync(Guid optionSetId, Guid itemId, UpsertOptionItemRequest request, CancellationToken ct) { var e = await _db.OptionItems.SingleOrDefaultAsync(x => x.Id == itemId && x.OptionSetId == optionSetId, ct).ConfigureAwait(false) ?? throw new NotFoundException("Option item not found"); var wasAvailable = e.IsAvailable; e.Name = request.Name; e.IsActive = request.IsActive; e.IsAvailable = request.IsAvailable; e.SortOrder = request.SortOrder; await _db.SaveChangesAsync(ct).ConfigureAwait(false); if (wasAvailable != e.IsAvailable) await AuditAsync("OptionItem", "UpdateOptionItemAvailability", e.Id, new { IsAvailable = wasAvailable }, new { e.IsAvailable }, ct).ConfigureAwait(false); return new(e.Id, e.OptionSetId, e.Name, e.IsActive, e.IsAvailable, e.SortOrder); }
    public async Task DeactivateOptionItemAsync(Guid optionSetId, Guid itemId, CancellationToken ct) { var e = await _db.OptionItems.SingleOrDefaultAsync(x => x.Id == itemId && x.OptionSetId == optionSetId, ct).ConfigureAwait(false) ?? throw new NotFoundException("Option item not found"); e.IsActive = false; await _db.SaveChangesAsync(ct).ConfigureAwait(false); }

    public async Task<IReadOnlyList<SchemaDto>> GetSchemasAsync(bool includeInactive, CancellationToken ct) => await _db.CustomizationSchemas.AsNoTracking().Where(x => includeInactive || x.IsActive).Select(x => new SchemaDto(x.Id, x.Name, x.IsActive)).ToListAsync(ct).ConfigureAwait(false);
    public async Task<SchemaDto> CreateSchemaAsync(UpsertSchemaRequest request, CancellationToken ct) { var e = new CustomizationSchema { Id = Guid.NewGuid(), Name = request.Name, IsActive = request.IsActive }; _db.CustomizationSchemas.Add(e); await _db.SaveChangesAsync(ct).ConfigureAwait(false); return new(e.Id, e.Name, e.IsActive); }
    public async Task<SchemaDto> UpdateSchemaAsync(Guid id, UpsertSchemaRequest request, CancellationToken ct) { var e = await FindAsync(_db.CustomizationSchemas, id, ct).ConfigureAwait(false); e.Name = request.Name; e.IsActive = request.IsActive; await _db.SaveChangesAsync(ct).ConfigureAwait(false); return new(e.Id, e.Name, e.IsActive); }
    public async Task DeactivateSchemaAsync(Guid id, CancellationToken ct) { var e = await FindAsync(_db.CustomizationSchemas, id, ct).ConfigureAwait(false); e.IsActive = false; await _db.SaveChangesAsync(ct).ConfigureAwait(false); }

    public async Task<IReadOnlyList<SelectionGroupDto>> GetGroupsAsync(Guid schemaId, bool includeInactive, CancellationToken ct) => await _db.SelectionGroups.AsNoTracking().Where(x => x.SchemaId == schemaId && (includeInactive || x.IsActive)).Select(x => Map(x)).ToListAsync(ct).ConfigureAwait(false);
    public async Task<SelectionGroupDto> CreateGroupAsync(Guid schemaId, UpsertSelectionGroupRequest request, CancellationToken ct) { await _groupValidator.EnsureValidAsync(request, ct).ConfigureAwait(false); await EnsureUniqueGroupKey(schemaId, request.Key, null, ct).ConfigureAwait(false); var e = new SelectionGroup { Id = Guid.NewGuid(), SchemaId = schemaId, Key = request.Key, Label = request.Label, SelectionMode = request.SelectionMode, MinSelections = request.MinSelections, MaxSelections = request.MaxSelections, OptionSetId = request.OptionSetId, IsActive = request.IsActive, SortOrder = request.SortOrder }; _db.SelectionGroups.Add(e); await _db.SaveChangesAsync(ct).ConfigureAwait(false); return Map(e); }
    public async Task<SelectionGroupDto> UpdateGroupAsync(Guid schemaId, Guid groupId, UpsertSelectionGroupRequest request, CancellationToken ct) { await _groupValidator.EnsureValidAsync(request, ct).ConfigureAwait(false); await EnsureUniqueGroupKey(schemaId, request.Key, groupId, ct).ConfigureAwait(false); var e = await _db.SelectionGroups.SingleOrDefaultAsync(x => x.Id == groupId && x.SchemaId == schemaId, ct).ConfigureAwait(false) ?? throw new NotFoundException("Selection group not found"); e.Key = request.Key; e.Label = request.Label; e.SelectionMode = request.SelectionMode; e.MinSelections = request.MinSelections; e.MaxSelections = request.MaxSelections; e.OptionSetId = request.OptionSetId; e.IsActive = request.IsActive; e.SortOrder = request.SortOrder; await _db.SaveChangesAsync(ct).ConfigureAwait(false); return Map(e); }
    public async Task DeactivateGroupAsync(Guid schemaId, Guid groupId, CancellationToken ct) { var e = await _db.SelectionGroups.SingleOrDefaultAsync(x => x.Id == groupId && x.SchemaId == schemaId, ct).ConfigureAwait(false) ?? throw new NotFoundException("Selection group not found"); e.IsActive = false; await _db.SaveChangesAsync(ct).ConfigureAwait(false); }

    public async Task<IReadOnlyList<ExtraDto>> GetExtrasAsync(bool includeInactive, CancellationToken ct) => await _db.Extras.AsNoTracking().Where(x => includeInactive || x.IsActive).Select(x => new ExtraDto(x.Id, x.Name, x.Price, x.IsActive, x.IsAvailable)).ToListAsync(ct).ConfigureAwait(false);
    public async Task<ExtraDto> CreateExtraAsync(UpsertExtraRequest request, CancellationToken ct) { await _extraValidator.EnsureValidAsync(request, ct).ConfigureAwait(false); var e = new Extra { Id = Guid.NewGuid(), Name = request.Name, Price = request.Price, IsActive = request.IsActive, IsAvailable = request.IsAvailable }; _db.Extras.Add(e); await _db.SaveChangesAsync(ct).ConfigureAwait(false); return new(e.Id, e.Name, e.Price, e.IsActive, e.IsAvailable); }
    public async Task<ExtraDto> UpdateExtraAsync(Guid id, UpsertExtraRequest request, CancellationToken ct) { await _extraValidator.EnsureValidAsync(request, ct).ConfigureAwait(false); var e = await FindAsync(_db.Extras, id, ct).ConfigureAwait(false); var wasAvailable = e.IsAvailable; e.Name = request.Name; e.Price = request.Price; e.IsActive = request.IsActive; e.IsAvailable = request.IsAvailable; await _db.SaveChangesAsync(ct).ConfigureAwait(false); if (wasAvailable != e.IsAvailable) await AuditAsync("Extra", "UpdateExtraAvailability", e.Id, new { IsAvailable = wasAvailable }, new { e.IsAvailable }, ct).ConfigureAwait(false); return new(e.Id, e.Name, e.Price, e.IsActive, e.IsAvailable); }
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

    public async Task<CatalogSnapshotDto> GetSnapshotAsync(Guid? storeId, CancellationToken ct)
    {
        var categories = await GetCategoriesAsync(false, ct).ConfigureAwait(false);
        var products = await GetProductsAsync(false, null, ct).ConfigureAwait(false);
        var optionSets = await GetOptionSetsAsync(false, ct).ConfigureAwait(false);
        var optionItems = await _db.OptionItems.AsNoTracking().Where(x => x.IsActive).Select(x => new OptionItemDto(x.Id, x.OptionSetId, x.Name, x.IsActive, x.IsAvailable, x.SortOrder)).ToListAsync(ct).ConfigureAwait(false);
        var schemas = await GetSchemasAsync(false, ct).ConfigureAwait(false);
        var groups = await _db.SelectionGroups.AsNoTracking().Where(x => x.IsActive).Select(x => Map(x)).ToListAsync(ct).ConfigureAwait(false);
        var extras = await GetExtrasAsync(false, ct).ConfigureAwait(false);
        var included = await _db.IncludedItems.AsNoTracking()
            .Join(_db.Products.AsNoTracking().Where(x => x.IsActive), i => i.ProductId, p => p.Id, (i, p) => i)
            .Join(_db.Extras.AsNoTracking().Where(x => x.IsActive), i => i.ExtraId, e => e.Id, (i, e) => new IncludedItemDto(i.Id, i.ProductId, i.ExtraId, i.Quantity))
            .ToListAsync(ct).ConfigureAwait(false);
        var overrides = await _db.ProductGroupOverrides.AsNoTracking().Where(x => x.IsActive).ToListAsync(ct).ConfigureAwait(false);
        var allowed = await _db.ProductGroupOverrideAllowedItems.AsNoTracking().ToListAsync(ct).ConfigureAwait(false);
        var overrideDtos = overrides.Select(o => new ProductOverrideDto(o.Id, o.ProductId, o.GroupKey, o.IsActive, allowed.Where(a => a.ProductGroupOverrideId == o.Id).Select(a => a.OptionItemId).ToList())).ToList();

        var stamp = ComputeVersionStamp(categories, products, optionSets, optionItems, schemas, groups, extras, included, overrideDtos);
        var etagSeed = await ComputeCatalogEtagAsync(ct).ConfigureAwait(false);
        var (resolvedStoreId, _) = await _storeContext.ResolveStoreAsync(storeId, ct).ConfigureAwait(false);
        var timeZoneId = await _db.Stores.AsNoTracking()
            .Where(x => x.Id == resolvedStoreId)
            .Select(x => x.TimeZoneId)
            .SingleAsync(ct)
            .ConfigureAwait(false);

        return new(resolvedStoreId, timeZoneId, DateTimeOffset.UtcNow, stamp, etagSeed, categories, products, optionSets, optionItems, schemas, groups, extras, included, overrideDtos, stamp);
    }

    public async Task<string> ComputeCatalogEtagAsync(CancellationToken ct)
    {
        var maxCategory = await _db.Categories.AsNoTracking().MaxAsync(x => (DateTimeOffset?)x.UpdatedAtUtc, ct).ConfigureAwait(false);
        var maxProduct = await _db.Products.AsNoTracking().MaxAsync(x => (DateTimeOffset?)x.UpdatedAtUtc, ct).ConfigureAwait(false);
        var maxExtra = await _db.Extras.AsNoTracking().MaxAsync(x => (DateTimeOffset?)x.UpdatedAtUtc, ct).ConfigureAwait(false);
        var maxOptionSet = await _db.OptionSets.AsNoTracking().MaxAsync(x => (DateTimeOffset?)x.UpdatedAtUtc, ct).ConfigureAwait(false);
        var maxOptionItem = await _db.OptionItems.AsNoTracking().MaxAsync(x => (DateTimeOffset?)x.UpdatedAtUtc, ct).ConfigureAwait(false);

        var maxTicks = new[] { maxCategory, maxProduct, maxExtra, maxOptionSet, maxOptionItem }
            .Where(x => x.HasValue)
            .Select(x => x!.Value.UtcTicks)
            .DefaultIfEmpty(0L)
            .Max();

        var categoryCount = await _db.Categories.AsNoTracking().CountAsync(ct).ConfigureAwait(false);
        var productCount = await _db.Products.AsNoTracking().CountAsync(ct).ConfigureAwait(false);
        var extraCount = await _db.Extras.AsNoTracking().CountAsync(ct).ConfigureAwait(false);
        var optionSetCount = await _db.OptionSets.AsNoTracking().CountAsync(ct).ConfigureAwait(false);
        var optionItemCount = await _db.OptionItems.AsNoTracking().CountAsync(ct).ConfigureAwait(false);

        return $"W/\"{maxTicks}-{categoryCount}-{productCount}-{extraCount}-{optionSetCount}-{optionItemCount}\"";
    }

    private static ProductDto Map(Product x) => new(x.Id, x.ExternalCode, x.Name, x.CategoryId, x.SubcategoryName, x.BasePrice, x.IsActive, x.IsAvailable, x.CustomizationSchemaId);
    private static SelectionGroupDto Map(SelectionGroup x) => new(x.Id, x.SchemaId, x.Key, x.Label, x.SelectionMode, x.MinSelections, x.MaxSelections, x.OptionSetId, x.IsActive, x.SortOrder);
    private static async Task<T> FindAsync<T>(DbSet<T> set, Guid id, CancellationToken ct) where T : class => await set.FindAsync([id], ct).ConfigureAwait(false) ?? throw new NotFoundException(typeof(T).Name + " not found");
    private async Task EnsureSchemaActiveIfPresent(Guid? schemaId, CancellationToken ct) { if (!schemaId.HasValue) return; var ok = await _db.CustomizationSchemas.AnyAsync(x => x.Id == schemaId && x.IsActive, ct).ConfigureAwait(false); if (!ok) throw new ValidationException(new Dictionary<string, string[]> { { "customizationSchemaId", ["Schema must exist and be active."] } }); }
    private async Task EnsureUniqueGroupKey(Guid schemaId, string key, Guid? ignoreId, CancellationToken ct) { var exists = await _db.SelectionGroups.AnyAsync(x => x.SchemaId == schemaId && x.Key == key && (!ignoreId.HasValue || x.Id != ignoreId.Value), ct).ConfigureAwait(false); if (exists) throw new ConflictException("SelectionGroup key already exists."); }
    private async Task<ProductOverrideDto> BuildOverrideDto(ProductGroupOverride o, CancellationToken ct) { var ids = await _db.ProductGroupOverrideAllowedItems.AsNoTracking().Where(x => x.ProductGroupOverrideId == o.Id).Select(x => x.OptionItemId).ToListAsync(ct).ConfigureAwait(false); return new(o.Id, o.ProductId, o.GroupKey, o.IsActive, ids); }
    private async Task AuditAsync(string entity, string action, Guid entityId, object? before, object? after, CancellationToken ct) { await _auditLogger.LogAsync(new AuditEntry(action, null, null, entity, entityId.ToString(), before, after, "Api", null, DateTime.UtcNow), ct).ConfigureAwait(false); PosCatalogLog.AuditWritten(_logger, action, entity, entityId); }

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
