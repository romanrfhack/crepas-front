namespace CobranzaDigital.Application.Common.Exceptions;

public sealed class ItemUnavailableException : DomainRuleException
{
    public ItemUnavailableException(string itemType, Guid itemId, string? itemName = null)
        : base($"{itemType} '{itemName ?? itemId.ToString("D")}' is currently unavailable.")
    {
        ItemType = itemType;
        ItemId = itemId;
        ItemName = itemName;
    }

    public string ItemType { get; }

    public Guid ItemId { get; }

    public string? ItemName { get; }
}
