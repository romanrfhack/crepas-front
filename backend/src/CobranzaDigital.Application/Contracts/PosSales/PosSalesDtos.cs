using CobranzaDigital.Domain.Entities;

namespace CobranzaDigital.Application.Contracts.PosSales;

public sealed record CreateSaleRequestDto(
    Guid? ClientSaleId,
    DateTimeOffset? OccurredAtUtc,
    IReadOnlyList<CreateSaleItemRequestDto> Items,
    CreatePaymentRequestDto? Payment,
    IReadOnlyList<CreatePaymentRequestDto>? Payments,
    Guid? StoreId);

public sealed record CreateSaleItemRequestDto(
    Guid ProductId,
    int Quantity,
    IReadOnlyList<CreateSaleItemSelectionRequestDto>? Selections,
    IReadOnlyList<CreateSaleItemExtraRequestDto>? Extras);

public sealed record CreateSaleItemSelectionRequestDto(string GroupKey, Guid OptionItemId);
public sealed record CreateSaleItemExtraRequestDto(Guid ExtraId, int Quantity);
public sealed record CreatePaymentRequestDto(PaymentMethod Method, decimal Amount, string? Reference);

public sealed record CreateSaleResponseDto(Guid SaleId, string Folio, DateTimeOffset OccurredAtUtc, decimal Total);

public sealed record VoidSaleRequestDto(string ReasonCode, string? ReasonText, string? Note, Guid? ClientVoidId);

public sealed record VoidSaleResponseDto(Guid SaleId, SaleStatus Status, DateTimeOffset VoidedAtUtc);

public sealed record DailySummaryDto(DateOnly Date, int TotalTickets, decimal TotalAmount, int TotalItems, decimal AvgTicket);

public sealed record TopProductDto(Guid ProductId, string ProductNameSnapshot, int Qty, decimal Amount);
