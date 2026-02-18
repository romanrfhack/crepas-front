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

public sealed record PosPaymentsBreakdownDto(decimal Cash, decimal Card, decimal Transfer);

public sealed record PosDailySalesReportRowDto(
    DateOnly BusinessDate,
    int Tickets,
    decimal Subtotal,
    decimal Discounts,
    decimal Tax,
    decimal TotalSales,
    decimal AvgTicket,
    int VoidsCount,
    decimal VoidsTotal,
    PosPaymentsBreakdownDto Payments);

public sealed record PosPaymentMethodTotalDto(PaymentMethod Method, int Count, decimal Amount);

public sealed record PosPaymentsMethodsReportDto(
    DateOnly DateFrom,
    DateOnly DateTo,
    IReadOnlyList<PosPaymentMethodTotalDto> Totals);

public sealed record PosHourlySalesReportRowDto(int Hour, int Tickets, decimal TotalSales);

public sealed record PosCashierSalesReportRowDto(
    Guid CashierUserId,
    int Tickets,
    decimal TotalSales,
    decimal AvgTicket,
    int VoidsCount,
    decimal VoidsTotal,
    PosPaymentsBreakdownDto Payments);

public sealed record PosShiftSummaryReportRowDto(
    Guid ShiftId,
    Guid CashierUserId,
    DateTimeOffset OpenedAtUtc,
    DateTimeOffset? ClosedAtUtc,
    string? CloseReason,
    int Tickets,
    decimal TotalSales,
    PosPaymentsBreakdownDto Payments,
    decimal ClosingExpectedCashAmount,
    decimal ClosingCountedCashAmount,
    decimal CashDifference);

public sealed record PosVoidReasonReportRowDto(string? ReasonCode, string? ReasonText, int Count, decimal Amount);
