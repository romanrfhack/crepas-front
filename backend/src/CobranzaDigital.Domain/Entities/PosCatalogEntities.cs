using System.Diagnostics.CodeAnalysis;

using CobranzaDigital.Domain.Common;

namespace CobranzaDigital.Domain.Entities;

[SuppressMessage("Naming", "CA1720:Identifier contains type name", Justification = "Domain term uses Single vs Multi selection semantics.")]
public enum SelectionMode
{
    Single = 0,
    Multi = 1
}

public enum CatalogItemType
{
    Product = 0,
    Extra = 1,
    OptionItem = 2
}

public enum CatalogOverrideState
{
    Enabled = 0,
    Disabled = 1
}

public enum InventoryAdjustmentReason
{
    InitialLoad = 0,
    Purchase = 1,
    Return = 2,
    Waste = 3,
    Damage = 4,
    Correction = 5,
    TransferIn = 6,
    TransferOut = 7,
    ManualCount = 8
}

public sealed class CatalogTemplate : Entity
{
    public Guid VerticalId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Version { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class TenantCatalogTemplate
{
    public Guid TenantId { get; set; }
    public Guid? CatalogTemplateId { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class TenantCatalogOverride
{
    public Guid TenantId { get; set; }
    public CatalogItemType ItemType { get; set; }
    public Guid ItemId { get; set; }
    public bool IsEnabled { get; set; } = true;
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class StoreCatalogAvailability
{
    public Guid StoreId { get; set; }
    public CatalogItemType ItemType { get; set; }
    public Guid ItemId { get; set; }
    public bool IsAvailable { get; set; } = true;
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class StoreCatalogOverride : Entity
{
    public Guid TenantId { get; set; }
    public Guid StoreId { get; set; }
    public CatalogItemType ItemType { get; set; }
    public Guid ItemId { get; set; }
    public CatalogOverrideState OverrideState { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class CatalogInventoryBalance : Entity
{
    public Guid TenantId { get; set; }
    public Guid StoreId { get; set; }
    public CatalogItemType ItemType { get; set; }
    public Guid ItemId { get; set; }
    public decimal OnHandQty { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class CatalogInventoryAdjustment : Entity
{
    public Guid TenantId { get; set; }
    public Guid StoreId { get; set; }
    public CatalogItemType ItemType { get; set; }
    public Guid ItemId { get; set; }
    public decimal QtyBefore { get; set; }
    public decimal DeltaQty { get; set; }
    public decimal ResultingOnHandQty { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? Reference { get; set; }
    public string? Note { get; set; }
    public string? ClientOperationId { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public Guid? CreatedByUserId { get; set; }
}

public sealed class Category : Entity
{
    public Guid? CatalogTemplateId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class Product : Entity
{
    public Guid? CatalogTemplateId { get; set; }
    public string? ExternalCode { get; set; }
    public string Name { get; set; } = string.Empty;
    public Guid CategoryId { get; set; }
    public string? SubcategoryName { get; set; }
    public decimal BasePrice { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsAvailable { get; set; } = true;
    public bool IsInventoryTracked { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public Guid? CustomizationSchemaId { get; set; }
}

public sealed class OptionSet : Entity
{
    public Guid? CatalogTemplateId { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class OptionItem : Entity
{
    public Guid? CatalogTemplateId { get; set; }
    public Guid OptionSetId { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public bool IsAvailable { get; set; } = true;
    public int SortOrder { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class CustomizationSchema : Entity
{
    public Guid? CatalogTemplateId { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

public sealed class SelectionGroup : Entity
{
    public Guid? CatalogTemplateId { get; set; }
    public Guid SchemaId { get; set; }
    public string Key { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public SelectionMode SelectionMode { get; set; }
    public int MinSelections { get; set; }
    public int MaxSelections { get; set; }
    public Guid OptionSetId { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
}

public sealed class Extra : Entity
{
    public Guid CatalogTemplateId { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsAvailable { get; set; } = true;
    public bool IsInventoryTracked { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class IncludedItem : Entity
{
    public Guid ProductId { get; set; }
    public Guid ExtraId { get; set; }
    public int Quantity { get; set; }
}

public sealed class ProductGroupOverride : Entity
{
    public Guid ProductId { get; set; }
    public string GroupKey { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

public sealed class ProductGroupOverrideAllowedItem
{
    public Guid ProductGroupOverrideId { get; set; }
    public Guid OptionItemId { get; set; }
}
