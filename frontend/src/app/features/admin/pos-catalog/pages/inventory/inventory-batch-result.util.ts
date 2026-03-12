import {
  CreateInventoryBatchAdjustmentV2LineRequest,
  InventoryBatchAdjustmentV2LineResultDto,
  InventoryBatchAdjustmentV2ResultDto,
} from '../../models/pos-catalog.models';

export type InventoryBatchResultFilter = 'All' | 'Applied' | 'Failed';

export interface InventoryBatchResultDisplayRow {
  lineNo: number;
  itemType: 'Product' | 'Extra';
  externalCode: string;
  itemId: string;
  deltaQty: number;
  status: 'Applied' | 'Failed';
  errorCode: string;
  message: string;
  qtyBefore: number | null;
  qtyAfter: number | null;
  deltaApplied: number | null;
  adjustmentId: string;
}

function toDisplayRow(
  line: InventoryBatchAdjustmentV2LineResultDto,
  requestLine?: CreateInventoryBatchAdjustmentV2LineRequest,
): InventoryBatchResultDisplayRow {
  return {
    lineNo: line.lineNo,
    itemType: requestLine?.itemType ?? 'Product',
    externalCode: requestLine?.itemExternalCode?.trim() ?? '',
    itemId: requestLine?.itemId?.trim() ?? '',
    deltaQty: requestLine?.quantityDelta ?? 0,
    status: line.status,
    errorCode: line.errorCode?.trim() ?? '',
    message: line.message?.trim() ?? '',
    qtyBefore: line.qtyBefore ?? null,
    qtyAfter: line.qtyAfter ?? null,
    deltaApplied: line.deltaApplied ?? null,
    adjustmentId: line.adjustmentId?.trim() ?? '',
  };
}

export function toInventoryBatchResultDisplayRows(
  result: InventoryBatchAdjustmentV2ResultDto,
  requestLines: CreateInventoryBatchAdjustmentV2LineRequest[],
): InventoryBatchResultDisplayRow[] {
  return result.lines.map((line) => toDisplayRow(line, requestLines[line.lineNo - 1]));
}

export function groupFailedByErrorCode(
  rows: InventoryBatchResultDisplayRow[],
): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const row of rows) {
    if (row.status !== 'Failed') {
      continue;
    }

    const code = row.errorCode || 'UNKNOWN_ERROR';
    summary[code] = (summary[code] ?? 0) + 1;
  }

  return summary;
}

export function filterBatchResultRows(
  rows: InventoryBatchResultDisplayRow[],
  filter: InventoryBatchResultFilter,
) {
  if (filter === 'All') {
    return rows;
  }

  return rows.filter((row) => row.status === filter);
}

function escapeCsvField(value: string): string {
  const normalized = value.replaceAll('"', '""');
  const shouldWrap =
    normalized.includes(',') ||
    normalized.includes('"') ||
    normalized.includes('\n') ||
    normalized.includes('\r');
  return shouldWrap ? `"${normalized}"` : normalized;
}

export function buildFailedRowsCsv(rows: InventoryBatchResultDisplayRow[]): string {
  const header = 'lineNo,itemType,externalCode,itemId,deltaQty,errorCode,message';
  const failedRows = rows.filter((row) => row.status === 'Failed');

  const body = failedRows
    .map((row) =>
      [
        row.lineNo.toString(),
        row.itemType,
        row.externalCode,
        row.itemId,
        row.deltaQty.toString(),
        row.errorCode,
        row.message,
      ]
        .map((value) => escapeCsvField(value))
        .join(','),
    )
    .join('\r\n');

  return `${header}\r\n${body}${body ? '\r\n' : ''}`;
}

export function hasIdempotencyReplay(rows: InventoryBatchResultDisplayRow[]): boolean {
  return rows.some(
    (row) =>
      row.errorCode === 'IDEMPOTENCY_CONFLICT' || row.message.toLowerCase().includes('idempotenc'),
  );
}
