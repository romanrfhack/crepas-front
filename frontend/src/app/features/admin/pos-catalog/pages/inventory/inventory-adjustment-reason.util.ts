import { InventoryAdjustmentReason } from '../../models/pos-catalog.models';

const REASON_LABELS: Record<string, string> = {
  InitialLoad: 'Carga inicial',
  Purchase: 'Compra',
  Return: 'Devolución',
  Waste: 'Merma',
  Damage: 'Daño',
  Correction: 'Corrección',
  TransferIn: 'Transferencia entrada',
  TransferOut: 'Transferencia salida',
  ManualCount: 'Conteo manual',
  SaleConsumption: 'Consumo por venta',
  VoidReversal: 'Reversa por cancelación',
};

export type InventoryReasonBadgeKind = 'sale-consumption' | 'void-reversal' | 'unknown' | 'default';

export interface InventoryAdjustmentReasonUi {
  label: string;
  rawReason: string;
  isKnown: boolean;
  badgeKind: InventoryReasonBadgeKind;
}

export function toInventoryAdjustmentReasonUi(
  reason: string | null | undefined,
  movementKind?: string | null,
): InventoryAdjustmentReasonUi {
  const rawMovementKind = movementKind?.trim() ?? '';
  if (rawMovementKind) {
    if (isKnownInventoryAdjustmentReason(rawMovementKind)) {
      const badgeKind =
        rawMovementKind === 'SaleConsumption'
          ? 'sale-consumption'
          : rawMovementKind === 'VoidReversal'
            ? 'void-reversal'
            : 'default';
      return {
        label: REASON_LABELS[rawMovementKind],
        rawReason: rawMovementKind,
        isKnown: true,
        badgeKind,
      };
    }

    return {
      label: `Otro (${rawMovementKind})`,
      rawReason: rawMovementKind,
      isKnown: false,
      badgeKind: 'unknown',
    };
  }

  const rawReason = reason?.trim() ?? '';
  if (!rawReason) {
    return {
      label: 'Otro',
      rawReason: '',
      isKnown: false,
      badgeKind: 'unknown',
    };
  }

  if (isKnownInventoryAdjustmentReason(rawReason)) {
    const badgeKind =
      rawReason === 'SaleConsumption'
        ? 'sale-consumption'
        : rawReason === 'VoidReversal'
          ? 'void-reversal'
          : 'default';
    return {
      label: REASON_LABELS[rawReason],
      rawReason,
      isKnown: true,
      badgeKind,
    };
  }

  return {
    label: `Otro (${rawReason})`,
    rawReason,
    isKnown: false,
    badgeKind: 'unknown',
  };
}

function isKnownInventoryAdjustmentReason(reason: string): reason is InventoryAdjustmentReason {
  return reason in REASON_LABELS;
}
