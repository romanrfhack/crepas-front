using CobranzaDigital.Application.Contracts.PosPricing;
using CobranzaDigital.Application.Services;
using Xunit;

namespace CobranzaDigital.Application.Tests;

public sealed class PosPricingQuoteCalculatorTests
{
    private readonly PosPricingQuoteCalculator _sut = new();

    [Fact]
    public void QtyLowerThanTierMin_DoesNotApply()
    {
        var result = _sut.ComputeLine(
            qty: 9,
            baseUnitPrice: 100m,
            tenantPolicy: new PosPricingTenantPolicyDto(true, [new PosPricingTierDto(10m, "Percent", 10m)]),
            productOverride: null,
            requestedUnitPrice: null);

        Assert.Equal(100m, result.AppliedUnitPrice);
        Assert.Null(result.TierApplied);
    }

    [Fact]
    public void QtyAtTierMin_Applies()
    {
        var result = _sut.ComputeLine(
            qty: 10,
            baseUnitPrice: 100m,
            tenantPolicy: new PosPricingTenantPolicyDto(true, [new PosPricingTierDto(10m, "Percent", 10m)]),
            productOverride: null,
            requestedUnitPrice: null);

        Assert.Equal(90m, result.AppliedUnitPrice);
        Assert.NotNull(result.TierApplied);
        Assert.Equal("tenant", result.TierApplied!.Source);
    }

    [Fact]
    public void OverrideDisabled_DoesNotApply()
    {
        var result = _sut.ComputeLine(
            qty: 10,
            baseUnitPrice: 100m,
            tenantPolicy: new PosPricingTenantPolicyDto(true, [new PosPricingTierDto(10m, "Percent", 10m)]),
            productOverride: new PosPricingProductOverrideDto("Disabled", []),
            requestedUnitPrice: null);

        Assert.Equal(100m, result.AppliedUnitPrice);
        Assert.Null(result.TierApplied);
    }

    [Fact]
    public void CustomTiers_UseProductSource()
    {
        var result = _sut.ComputeLine(
            qty: 12,
            baseUnitPrice: 100m,
            tenantPolicy: new PosPricingTenantPolicyDto(true, [new PosPricingTierDto(10m, "Percent", 10m)]),
            productOverride: new PosPricingProductOverrideDto("CustomTiers", [new PosPricingTierDto(12m, "FixedUnitPrice", 70m)]),
            requestedUnitPrice: null);

        Assert.Equal(70m, result.AppliedUnitPrice);
        Assert.Equal("product", result.TierApplied!.Source);
    }

    [Fact]
    public void Rounding_IsConsistent()
    {
        var result = _sut.ComputeLine(
            qty: 3,
            baseUnitPrice: 10.005m,
            tenantPolicy: new PosPricingTenantPolicyDto(true, [new PosPricingTierDto(3m, "Percent", 5m)]),
            productOverride: null,
            requestedUnitPrice: 9.49m);

        Assert.Equal(10.01m, result.BaseUnitPrice);
        Assert.Equal(9.51m, result.AppliedUnitPrice);
        Assert.Equal(28.53m, result.LineSubtotal);
        Assert.True(result.IsMismatch);
        Assert.Equal(9.51m, result.ExpectedUnitPrice);
    }
}
