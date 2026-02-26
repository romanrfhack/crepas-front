import { toInventoryAdjustmentReasonUi } from './inventory-adjustment-reason.util';

describe('toInventoryAdjustmentReasonUi', () => {
  it('maps SaleConsumption to friendly label', () => {
    const result = toInventoryAdjustmentReasonUi('SaleConsumption');

    expect(result.label).toBe('Consumo por venta');
    expect(result.badgeKind).toBe('sale-consumption');
    expect(result.isKnown).toBe(true);
  });

  it('maps VoidReversal to friendly label', () => {
    const result = toInventoryAdjustmentReasonUi('VoidReversal');

    expect(result.label).toBe('Reversa por cancelación');
    expect(result.badgeKind).toBe('void-reversal');
    expect(result.isKnown).toBe(true);
  });

  it('falls back safely for unknown reasons', () => {
    const result = toInventoryAdjustmentReasonUi('FutureReason');

    expect(result.label).toBe('Otro (FutureReason)');
    expect(result.badgeKind).toBe('unknown');
    expect(result.isKnown).toBe(false);
  });
});
