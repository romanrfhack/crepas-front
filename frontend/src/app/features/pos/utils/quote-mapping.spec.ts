import { CartItem, PosPricingQuoteResponseDto } from '../models/pos.models';
import { applyQuoteResponseToCart } from './quote-mapping';

describe('applyQuoteResponseToCart', () => {
  it('maps mismatched quote line to cart snapshot', () => {

    const cart: CartItem[] = [
      {
        id: '1',
        productId: 'p1',
        productName: 'Latte',
        basePrice: 100,
        baseUnitPrice: 100,
        appliedUnitPrice: 100,
        wholesaleTierLabel: null,
        wholesale: {
          isApplied: false,
          minQty: null,
          discountType: null,
          discountValue: null,
          source: null,
        },
        pricingCalculatedAtUtc: null,
        quantity: 10,
        selections: [],
        extras: [],
      },
    ];

    const quote: PosPricingQuoteResponseDto = {
      lines: [
        {
          productId: 'p1',
          externalCode: null,
          qty: 10,
          baseUnitPrice: 100,
          appliedUnitPrice: 90,
          tierApplied: {
            minQty: 10,
            discountType: 'Percent',
            discountValue: 10,
            source: 'tenant',
          },
          lineSubtotal: 900,
          isMismatch: true,
          expectedUnitPrice: 90,
        },
      ],
      totals: { subtotal: 900, total: 900 },
    };

    const result = applyQuoteResponseToCart(cart, quote);
    expect(result[0].appliedUnitPrice).toBe(90);
    expect(result[0].wholesale.isApplied).toBeTruthy();
    expect(result[0].wholesale.source).toBe('tenant');
    expect(result[0].pricingCalculatedAtUtc).toBeTruthy();
  });
});
