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

public sealed record PosCategorySalesMixItemDto(
    Guid CategoryId,
    string CategoryName,
    int Tickets,
    int Quantity,
    decimal GrossSales);

public sealed record PosCategorySalesMixResponseDto(IReadOnlyList<PosCategorySalesMixItemDto> Items);

public sealed record PosProductSalesMixItemDto(
    Guid ProductId,
    string? Sku,
    string ProductName,
    int Tickets,
    int Quantity,
    decimal GrossSales);

public sealed record PosProductSalesMixResponseDto(IReadOnlyList<PosProductSalesMixItemDto> Items);

public sealed record PosTopExtraAddonItemDto(
    Guid ExtraId,
    string? ExtraSku,
    string ExtraName,
    int Quantity,
    decimal GrossSales);

public sealed record PosTopExtraAddonsResponseDto(IReadOnlyList<PosTopExtraAddonItemDto> Items);

public sealed record PosTopOptionAddonItemDto(
    Guid OptionItemId,
    string? OptionItemSku,
    string OptionItemName,
    int UsageCount,
    decimal GrossImpact);

public sealed record PosTopOptionAddonsResponseDto(IReadOnlyList<PosTopOptionAddonItemDto> Items);

public sealed record PosKpisSummaryDto(
    int Tickets,
    int TotalItems,
    decimal GrossSales,
    decimal AvgTicket,
    decimal AvgItemsPerTicket,
    int VoidCount,
    decimal VoidRate);

public sealed record PosCashDifferencesDailyRowDto(
    DateOnly Date,
    Guid? CashierUserId,
    int Shifts,
    decimal ExpectedCash,
    decimal CountedCash,
    decimal Difference,
    int ReasonCount);

public sealed record PosCashDifferencesShiftRowDto(
    Guid ShiftId,
    DateTimeOffset OpenedAt,
    DateTimeOffset? ClosedAt,
    Guid CashierUserId,
    string? CashierUserName,
    decimal ExpectedCash,
    decimal CountedCash,
    decimal Difference,
    string? CloseReason);

public sealed record PosCashDifferencesResponseDto(
    IReadOnlyList<PosCashDifferencesDailyRowDto> Daily,
    IReadOnlyList<PosCashDifferencesShiftRowDto> Shifts);
