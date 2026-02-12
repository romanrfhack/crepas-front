using System.Diagnostics.CodeAnalysis;

using CobranzaDigital.Domain.Common;

namespace CobranzaDigital.Domain.Entities;

[SuppressMessage("Naming", "CA1720:Identifier contains type name", Justification = "Domain term uses Single vs Multi selection semantics.")]
public enum SelectionMode
{
    Single = 0,
    Multi = 1
}

public sealed class Category : Entity
{
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class Product : Entity
{
    public string? ExternalCode { get; set; }
    public string Name { get; set; } = string.Empty;
    public Guid CategoryId { get; set; }
    public string? SubcategoryName { get; set; }
    public decimal BasePrice { get; set; }
    public bool IsActive { get; set; } = true;
    public Guid? CustomizationSchemaId { get; set; }
}

public sealed class OptionSet : Entity
{
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

public sealed class OptionItem : Entity
{
    public Guid OptionSetId { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
}

public sealed class CustomizationSchema : Entity
{
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

public sealed class SelectionGroup : Entity
{
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
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public bool IsActive { get; set; } = true;
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
