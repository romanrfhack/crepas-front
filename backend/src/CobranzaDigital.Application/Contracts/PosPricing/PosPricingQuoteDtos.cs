namespace CobranzaDigital.Application.Contracts.PosPricing;

public sealed record PosPricingQuoteRequestDto(
    Guid StoreId,
    PosPricingTenantPolicyDto? TenantPolicy,
    IReadOnlyList<PosPricingQuoteLineRequestDto> Lines);

public sealed record PosPricingTenantPolicyDto(
    bool IsEnabled,
    IReadOnlyList<PosPricingTierDto> Tiers);

public sealed record PosPricingQuoteLineRequestDto(
    Guid? ProductId,
    string? ExternalCode,
    decimal Qty,
    decimal? BasePrice,
    decimal? RequestedUnitPrice,
    PosPricingProductOverrideDto? Override);

public sealed record PosPricingProductOverrideDto(
    string Mode,
    IReadOnlyList<PosPricingTierDto> Tiers);

public sealed record PosPricingTierDto(
    decimal MinQty,
    string DiscountType,
    decimal DiscountValue);

public sealed record PosPricingQuoteResponseDto(
    IReadOnlyList<PosPricingQuoteLineResponseDto> Lines,
    PosPricingQuoteTotalsDto Totals);

public sealed record PosPricingQuoteLineResponseDto(
    Guid ProductId,
    string? ExternalCode,
    decimal Qty,
    decimal BaseUnitPrice,
    decimal AppliedUnitPrice,
    PosPricingTierAppliedDto? TierApplied,
    decimal LineSubtotal,
    bool IsMismatch,
    decimal? ExpectedUnitPrice);

public sealed record PosPricingTierAppliedDto(
    decimal MinQty,
    string DiscountType,
    decimal DiscountValue,
    string Source);

public sealed record PosPricingQuoteTotalsDto(
    decimal Subtotal,
    decimal Total);
