namespace CobranzaDigital.Application.Common.Exceptions;

public sealed class ItemUnavailableException : DomainRuleException
{
    public ItemUnavailableException(string itemType, Guid itemId, string? itemName = null, string reason = "UnavailableInStore", decimal? availableQty = null)
        : base($"{itemType} '{itemName ?? itemId.ToString("D")}' is currently unavailable.")
    {
        ItemType = itemType;
        ItemId = itemId;
        ItemName = itemName;
        Reason = reason;
        AvailableQty = availableQty;
    }

    public string ItemType { get; }

    public Guid ItemId { get; }

    public string? ItemName { get; }

    public string Reason { get; }

    public decimal? AvailableQty { get; }
}
