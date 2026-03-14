import { WholesalePricingService } from './wholesale-pricing.service';

describe('WholesalePricingService', () => {
  const service = new WholesalePricingService();

  it('returns base price when policy is missing', () => {
    const result = service.quote({ qty: 10, basePrice: 100, policy: null, override: null });
    expect(result.appliedUnitPrice).toBe(100);
    expect(result.tierApplied).toBeNull();
    expect(result.baseUnitPrice).toBe(100);
    expect(result.wholesale.isApplied).toBeFalsy();
  });

  it('applies enabled tenant tier', () => {
    const result = service.quote({
      qty: 10,
      basePrice: 100,
      policy: {
        isEnabled: true,
        name: 'Default',
        tiers: [{ minQty: 10, discountType: 'Percent', discountValue: 10 }],
      },
      override: null,
    });

    expect(result.appliedUnitPrice).toBe(90);
    expect(result.tierLabel).toContain('≥10');
    expect(result.wholesale.source).toBe('tenant');
  });

  it('does not apply when override mode is disabled', () => {
    const result = service.quote({
      qty: 12,
      basePrice: 100,
      policy: {
        isEnabled: true,
        name: 'Default',
        tiers: [{ minQty: 10, discountType: 'Percent', discountValue: 10 }],
      },
      override: { productId: 'p1', mode: 'Disabled', tiers: [] },
    });

    expect(result.appliedUnitPrice).toBe(100);
  });

  it('applies custom fixed unit price override', () => {
    const result = service.quote({
      qty: 12,
      basePrice: 100,
      policy: {
        isEnabled: true,
        name: 'Default',
        tiers: [{ minQty: 10, discountType: 'Percent', discountValue: 10 }],
      },
      override: {
        productId: 'p1',
        mode: 'CustomTiers',
        tiers: [{ minQty: 12, discountType: 'FixedUnitPrice', discountValue: 70 }],
      },
    });

    expect(result.appliedUnitPrice).toBe(70);
    expect(result.wholesale.source).toBe('product');
  });

  it('applies tier on exact boundary qty', () => {
    const result = service.quote({
      qty: 10,
      basePrice: 100,
      policy: {
        isEnabled: true,
        name: 'Default',
        tiers: [{ minQty: 10, discountType: 'Percent', discountValue: 15 }],
      },
      override: null,
    });

    expect(result.appliedUnitPrice).toBe(85);
  });
});
