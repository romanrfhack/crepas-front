namespace CobranzaDigital.Application.Common.Exceptions;

public sealed class InventoryAdjustmentConflictException : DomainRuleException
{
    public InventoryAdjustmentConflictException(string reason, string message)
        : base(message)
    {
        Reason = reason;
    }

    public string Reason { get; }
}
