import { CartItem, PosPricingQuoteResponseDto } from '../models/pos.models';

export function applyQuoteResponseToCart(items: CartItem[], quote: PosPricingQuoteResponseDto): CartItem[] {
  const byProductId = new Map(quote.lines.map((line) => [line.productId, line]));

  return items.map((item) => {
    const quoted = byProductId.get(item.productId);
    if (!quoted || !quoted.isMismatch) {
      return item;
    }

    return {
      ...item,
      baseUnitPrice: quoted.baseUnitPrice,
      appliedUnitPrice: quoted.appliedUnitPrice,
      wholesaleTierLabel: quoted.tierApplied
        ? quoted.tierApplied.discountType === 'Percent'
          ? `≥${quoted.tierApplied.minQty}: -${quoted.tierApplied.discountValue}%`
          : `≥${quoted.tierApplied.minQty}: $${quoted.tierApplied.discountValue.toFixed(2)} c/u`
        : null,
      wholesale: {
        isApplied: quoted.tierApplied !== null,
        minQty: quoted.tierApplied?.minQty ?? null,
        discountType: quoted.tierApplied?.discountType ?? null,
        discountValue: quoted.tierApplied?.discountValue ?? null,
        source: quoted.tierApplied?.source ?? null,
      },
      pricingCalculatedAtUtc: new Date().toISOString(),
    };
  });
}
