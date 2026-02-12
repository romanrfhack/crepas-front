using CobranzaDigital.Domain.Common;
using System.Text.Json.Serialization;

namespace CobranzaDigital.Domain.Entities;

public enum SaleStatus
{
    Completed = 0,
    Void = 1
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum PaymentMethod
{
    Cash = 0,
    Card = 1,
    Transfer = 2
}

public sealed class Sale : Entity
{
    public string Folio { get; set; } = string.Empty;
    public DateTimeOffset OccurredAtUtc { get; set; }
    public string Currency { get; set; } = "MXN";
    public decimal Subtotal { get; set; }
    public decimal Total { get; set; }
    public Guid CreatedByUserId { get; set; }
    public string? CorrelationId { get; set; }
    public Guid? ClientSaleId { get; set; }
    public Guid? ShiftId { get; set; }
    public SaleStatus Status { get; set; } = SaleStatus.Completed;
}

public sealed class PosShift : Entity
{
    public DateTimeOffset OpenedAtUtc { get; set; }
    public Guid OpenedByUserId { get; set; }
    public string? OpenedByEmail { get; set; }
    public decimal OpeningCashAmount { get; set; }
    public DateTimeOffset? ClosedAtUtc { get; set; }
    public Guid? ClosedByUserId { get; set; }
    public string? ClosedByEmail { get; set; }
    public decimal? ClosingCashAmount { get; set; }
    public string? OpenNotes { get; set; }
    public string? CloseNotes { get; set; }
    public Guid? OpenOperationId { get; set; }
    public Guid? CloseOperationId { get; set; }
}

public sealed class SaleItem : Entity
{
    public Guid SaleId { get; set; }
    public Guid ProductId { get; set; }
    public string? ProductExternalCode { get; set; }
    public string ProductNameSnapshot { get; set; } = string.Empty;
    public decimal UnitPriceSnapshot { get; set; }
    public int Quantity { get; set; }
    public decimal LineTotal { get; set; }
    public string? NotesSnapshot { get; set; }
}

public sealed class SaleItemSelection : Entity
{
    public Guid SaleItemId { get; set; }
    public string GroupKey { get; set; } = string.Empty;
    public Guid OptionItemId { get; set; }
    public string OptionItemNameSnapshot { get; set; } = string.Empty;
    public decimal PriceDeltaSnapshot { get; set; }
}

public sealed class SaleItemExtra : Entity
{
    public Guid SaleItemId { get; set; }
    public Guid ExtraId { get; set; }
    public string ExtraNameSnapshot { get; set; } = string.Empty;
    public decimal UnitPriceSnapshot { get; set; }
    public int Quantity { get; set; }
    public decimal LineTotal { get; set; }
}

public sealed class Payment : Entity
{
    public Guid SaleId { get; set; }
    public PaymentMethod Method { get; set; }
    public decimal Amount { get; set; }
    public string? Reference { get; set; }
}
