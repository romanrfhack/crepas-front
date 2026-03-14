using CobranzaDigital.Application.Common.Exceptions;
using CobranzaDigital.Application.Contracts.PosPricing;

using FluentValidation.Results;

namespace CobranzaDigital.Application.Services;

public sealed class PosPricingQuoteCalculator
{
    private const string DiscountTypePercent = "Percent";
    private const string DiscountTypeFixed = "FixedUnitPrice";

    public PosPricingQuoteComputedLine ComputeLine(
        decimal qty,
        decimal baseUnitPrice,
        PosPricingTenantPolicyDto? tenantPolicy,
        PosPricingProductOverrideDto? productOverride,
        decimal? requestedUnitPrice)
    {
        var normalizedQty = Normalize(qty);
        var normalizedBasePrice = RoundMoney(baseUnitPrice);
        var (appliedUnitPrice, tierApplied) = QuoteLine(normalizedQty, normalizedBasePrice, tenantPolicy, productOverride);
        var lineSubtotal = RoundMoney(appliedUnitPrice * normalizedQty);
        var hasMismatch = requestedUnitPrice.HasValue && RoundMoney(requestedUnitPrice.Value) != appliedUnitPrice;

        return new PosPricingQuoteComputedLine(
            normalizedQty,
            normalizedBasePrice,
            appliedUnitPrice,
            lineSubtotal,
            tierApplied,
            hasMismatch,
            hasMismatch ? appliedUnitPrice : null);
    }

    public decimal RoundMoney(decimal value) => decimal.Round(value, 2, MidpointRounding.AwayFromZero);

    private (decimal AppliedUnitPrice, PosPricingTierAppliedDto? TierApplied) QuoteLine(
        decimal qty,
        decimal baseUnitPrice,
        PosPricingTenantPolicyDto? tenantPolicy,
        PosPricingProductOverrideDto? productOverride)
    {
        if (qty <= 0m)
        {
            return (baseUnitPrice, null);
        }

        var mode = productOverride?.Mode ?? "UseTenantDefault";
        if (string.Equals(mode, "Disabled", StringComparison.OrdinalIgnoreCase))
        {
            return (baseUnitPrice, null);
        }

        var tiers = ResolveTiers(tenantPolicy, productOverride, mode);
        var tier = tiers.Where(x => qty >= x.MinQty).LastOrDefault();
        if (tier is null)
        {
            return (baseUnitPrice, null);
        }

        var applied = string.Equals(tier.DiscountType, DiscountTypePercent, StringComparison.OrdinalIgnoreCase)
            ? RoundMoney(baseUnitPrice * (1m - (tier.DiscountValue / 100m)))
            : RoundMoney(tier.DiscountValue);

        return (applied, tier);
    }

    private IReadOnlyList<PosPricingTierAppliedDto> ResolveTiers(
        PosPricingTenantPolicyDto? tenantPolicy,
        PosPricingProductOverrideDto? productOverride,
        string mode)
    {
        if (string.Equals(mode, "CustomTiers", StringComparison.OrdinalIgnoreCase))
        {
            return NormalizeTiers(productOverride?.Tiers ?? [], "product");
        }

        if (tenantPolicy?.IsEnabled != true)
        {
            return [];
        }

        return NormalizeTiers(tenantPolicy.Tiers, "tenant");
    }

    private IReadOnlyList<PosPricingTierAppliedDto> NormalizeTiers(IReadOnlyList<PosPricingTierDto> tiers, string source)
    {
        return tiers
            .Select(x => new PosPricingTierAppliedDto(
                Normalize(x.MinQty),
                NormalizeDiscountType(x.DiscountType),
                Normalize(x.DiscountValue),
                source))
            .Where(x => x.MinQty > 0m)
            .OrderBy(x => x.MinQty)
            .ToList();
    }

    private static string NormalizeDiscountType(string value)
    {
        if (string.Equals(value, DiscountTypePercent, StringComparison.OrdinalIgnoreCase))
        {
            return DiscountTypePercent;
        }

        if (string.Equals(value, DiscountTypeFixed, StringComparison.OrdinalIgnoreCase))
        {
            return DiscountTypeFixed;
        }

        throw new ValidationException([new ValidationFailure("discountType", "Unsupported discountType.")]);
    }

    private static decimal Normalize(decimal value) => decimal.IsFinite(value) ? value : 0m;
}

public sealed record PosPricingQuoteComputedLine(
    decimal Qty,
    decimal BaseUnitPrice,
    decimal AppliedUnitPrice,
    decimal LineSubtotal,
    PosPricingTierAppliedDto? TierApplied,
    bool IsMismatch,
    decimal? ExpectedUnitPrice);
