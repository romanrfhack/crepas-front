export interface CloseShiftFormDefaults {
  reason: string;
  evidence: string;
  counts: number[];
}

export interface VoidSaleFormDefaults {
  reasonCode: 'CashierError';
  reasonText: string;
  note: string;
}

export const buildZeroDenominationCounts = (denominations: readonly number[]) =>
  denominations.map(() => 0);

export const createCloseShiftFormDefaults = (
  denominations: readonly number[],
): CloseShiftFormDefaults => ({
  reason: '',
  evidence: '',
  counts: buildZeroDenominationCounts(denominations),
});

export const createVoidSaleFormDefaults = (): VoidSaleFormDefaults => ({
  reasonCode: 'CashierError',
  reasonText: '',
  note: '',
});
