using System.Text.Json.Serialization;

using CobranzaDigital.Domain.Common;

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
    public Guid StoreId { get; set; }
    public Guid TenantId { get; set; }
    public SaleStatus Status { get; set; } = SaleStatus.Completed;
    public DateTimeOffset? VoidedAtUtc { get; set; }
    public Guid? VoidedByUserId { get; set; }
    public string? VoidReasonCode { get; set; }
    public string? VoidReasonText { get; set; }
    public string? VoidNote { get; set; }
    public Guid? ClientVoidId { get; set; }
    public int? LoyaltyPointsAwarded { get; set; }
    public Guid? LoyaltyEarnTransactionId { get; set; }
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
    public decimal? ExpectedCashAmount { get; set; }
    public decimal? CashDifference { get; set; }
    public string? DenominationsJson { get; set; }
    public string? OpenNotes { get; set; }
    public string? CloseNotes { get; set; }
    public Guid? OpenOperationId { get; set; }
    public Guid? CloseOperationId { get; set; }
    public Guid StoreId { get; set; }
    public Guid TenantId { get; set; }
    public string? CloseReason { get; set; }
}

public sealed class Store : Entity
{
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public string TimeZoneId { get; set; } = "America/Mexico_City";
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class Vertical : Entity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class Tenant : Entity
{
    public Guid VerticalId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public Guid? DefaultStoreId { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class PosSettings : Entity
{
    public bool MultiStoreEnabled { get; set; }
    public int MaxStoresAllowed { get; set; } = 1;
    public decimal CashDifferenceThreshold { get; set; } = 0m;
    public Guid DefaultStoreId { get; set; }
    public bool ShowOnlyInStock { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class StoreInventory : Entity
{
    public Guid StoreId { get; set; }
    public Guid ProductId { get; set; }
    public decimal OnHand { get; set; }
    public decimal Reserved { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public Guid? UpdatedByUserId { get; set; }
    public byte[] RowVersion { get; set; } = [];
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
    public DateTimeOffset CreatedAtUtc { get; set; }
}

public enum VoidReasonCode
{
    CustomerRequest = 0,
    CashierError = 1,
    FraudSuspected = 2,
    DuplicateCharge = 3,
    Other = 4
}
