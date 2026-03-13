import { InventoryAdjustmentReason } from '../../models/pos-catalog.models';

const HEADER_ALIASES: Record<string, ParsedImportHeader> = {
  externalcode: 'externalCode',
  external_code: 'externalCode',
  sku: 'externalCode',
  productcode: 'externalCode',
  delta: 'deltaQty',
  deltaqty: 'deltaQty',
  qtydelta: 'deltaQty',
  reason: 'reasonCode',
  reasoncode: 'reasonCode',
  store: 'storeId',
  storeid: 'storeId',
  itemtype: 'itemType',
  itemid: 'itemId',
  referenceid: 'referenceId',
  note: 'note',
};

const REQUIRED_HEADER_GROUPS: ParsedImportHeader[][] = [
  ['storeId'],
  ['itemType'],
  ['externalCode', 'itemId'],
  ['deltaQty'],
  ['reasonCode'],
];

export interface ParsedInventoryImportRow {
  lineNo: number;
  storeId: string;
  itemType: string;
  externalCode: string;
  itemId: string;
  deltaQty: string;
  reasonCode: string;
  referenceId: string;
  note: string;
}

type ParsedImportHeader =
  | 'storeId'
  | 'itemType'
  | 'externalCode'
  | 'itemId'
  | 'deltaQty'
  | 'reasonCode'
  | 'referenceId'
  | 'note';

export interface ParsedInventoryImportCsv {
  rows: ParsedInventoryImportRow[];
  missingRequiredColumns: string[];
}

function stripBom(value: string) {
  return value.replace(/^\uFEFF/, '');
}

function normalizeHeaderName(header: string): string {
  return stripBom(header).trim().toLowerCase().replace(/\s+/g, '').replace(/-/g, '_');
}

function normalizeHeader(header: string): ParsedImportHeader | null {
  const normalized = normalizeHeaderName(header);
  return HEADER_ALIASES[normalized] ?? null;
}

function parseCsvRecords(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];

    if (char === '"') {
      const next = csv[index + 1];
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && char === ',') {
      row.push(cell.trim());
      cell = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && csv[index + 1] === '\n') {
        index += 1;
      }
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows.filter((currentRow) => currentRow.some((currentCell) => currentCell.length > 0));
}

function toMissingHeaders(headers: ParsedImportHeader[]): string[] {
  const missing: string[] = [];

  for (const group of REQUIRED_HEADER_GROUPS) {
    if (group.some((header) => headers.includes(header))) {
      continue;
    }

    missing.push(group.join(' o '));
  }

  return missing;
}

function toReasonCode(reasonCode: string): InventoryAdjustmentReason {
  return (reasonCode as InventoryAdjustmentReason) || 'Correction';
}

export interface ParsedDeltaQty {
  value: number | null;
  error: string | null;
}

export function parseDeltaQty(rawDeltaQty: string): ParsedDeltaQty {
  if (rawDeltaQty.includes(',')) {
    return {
      value: null,
      error:
        'DeltaQty usa coma decimal. Usa punto (.) o cambia la configuración regional de Excel.',
    };
  }

  if (!/^-?\d+(\.\d+)?$/.test(rawDeltaQty)) {
    return { value: null, error: 'VALIDATION_ERROR' };
  }

  const parsedValue = Number.parseFloat(rawDeltaQty);
  if (!Number.isFinite(parsedValue)) {
    return { value: null, error: 'VALIDATION_ERROR' };
  }

  return { value: Math.round(parsedValue * 1000) / 1000, error: null };
}

export function parseInventoryImportCsv(csv: string): ParsedInventoryImportCsv {
  const normalizedCsv = stripBom(csv);
  const records = parseCsvRecords(normalizedCsv);
  if (!records.length) {
    return { rows: [], missingRequiredColumns: [] };
  }

  const [rawHeaders, ...rawRows] = records;
  const normalizedHeaders = rawHeaders.map((header) => normalizeHeader(header));
  const mappedHeaders = normalizedHeaders.filter(
    (header): header is ParsedImportHeader => !!header,
  );
  const missingRequiredColumns = toMissingHeaders(mappedHeaders);

  const rows = rawRows.map((rawRow, index) => {
    const byHeader: Partial<Record<ParsedImportHeader, string>> = {};
    normalizedHeaders.forEach((header, headerIndex) => {
      if (!header) {
        return;
      }

      byHeader[header] = rawRow[headerIndex]?.trim() ?? '';
    });

    return {
      lineNo: index + 1,
      storeId: byHeader.storeId ?? '',
      itemType: byHeader.itemType ?? '',
      externalCode: byHeader.externalCode ?? '',
      itemId: byHeader.itemId ?? '',
      deltaQty: byHeader.deltaQty ?? '',
      reasonCode: toReasonCode(byHeader.reasonCode ?? ''),
      referenceId: byHeader.referenceId ?? '',
      note: byHeader.note ?? '',
    };
  });

  return { rows, missingRequiredColumns };
}
