import { toInventoryAdjustmentReasonUi } from './inventory-adjustment-reason.util';

describe('toInventoryAdjustmentReasonUi', () => {
  it('maps movementKind SaleConsumption to friendly label', () => {
    const result = toInventoryAdjustmentReasonUi('ManualCount', 'SaleConsumption');

    expect(result.label).toBe('Consumo por venta');
    expect(result.badgeKind).toBe('sale-consumption');
    expect(result.isKnown).toBe(true);
  });

  it('maps movementKind VoidReversal to friendly label', () => {
    const result = toInventoryAdjustmentReasonUi('Correction', 'VoidReversal');

    expect(result.label).toBe('Reversa por cancelación');
    expect(result.badgeKind).toBe('void-reversal');
    expect(result.isKnown).toBe(true);
  });

  it('falls back to reason when movementKind is null', () => {
    const result = toInventoryAdjustmentReasonUi('SaleConsumption', null);

    expect(result.label).toBe('Consumo por venta');
    expect(result.badgeKind).toBe('sale-consumption');
    expect(result.isKnown).toBe(true);
  });

  it('falls back safely for unknown movementKind', () => {
    const result = toInventoryAdjustmentReasonUi('SaleConsumption', 'FutureMovement');

    expect(result.label).toBe('Otro (FutureMovement)');
    expect(result.badgeKind).toBe('unknown');
    expect(result.isKnown).toBe(false);
  });
});
