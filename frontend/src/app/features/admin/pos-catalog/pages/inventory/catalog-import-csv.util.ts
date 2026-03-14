const BOOLEAN_TRUE = new Set(['true', '1', 'yes', 'si']);
const BOOLEAN_FALSE = new Set(['false', '0', 'no']);

function stripBom(value: string) {
  return value.replace(/^\uFEFF/, '');
}

function normalize(value: string) {
  return stripBom(value).trim().toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
}

function parseCsvRecords(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    if (char === '"') {
      if (inQuotes && csv[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ',') {
      row.push(cell.trim());
      cell = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && csv[i + 1] === '\n') i += 1;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  if (cell.length || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows.filter((currentRow) => currentRow.some((cellValue) => cellValue.length > 0));
}

function parseBoolean(raw: string, defaultValue: boolean) {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (BOOLEAN_TRUE.has(normalized)) return true;
  if (BOOLEAN_FALSE.has(normalized)) return false;
  return defaultValue;
}

export interface ParsedCategoryImportRow {
  lineNo: number;
  categoryCode: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ParsedProductImportRow {
  lineNo: number;
  externalCode: string;
  name: string;
  categoryCode: string;
  basePrice: number;
  isActive: boolean;
  isAvailable: boolean;
  isInventoryTracked: boolean;
  subcategoryName: string;
}

export function parseCategoriesImportCsv(csv: string): ParsedCategoryImportRow[] {
  const records = parseCsvRecords(stripBom(csv));
  if (!records.length) return [];
  const [headers, ...rows] = records;
  const indexByHeader = new Map(headers.map((header, index) => [normalize(header), index]));

  const idxCode = indexByHeader.get('categorycode') ?? indexByHeader.get('code') ?? -1;
  const idxName = indexByHeader.get('name') ?? -1;
  const idxSort = indexByHeader.get('sortorder') ?? -1;
  const idxActive = indexByHeader.get('isactive') ?? -1;

  return rows.map((row, index) => ({
    lineNo: index + 1,
    categoryCode: idxCode >= 0 ? row[idxCode] ?? '' : '',
    name: idxName >= 0 ? row[idxName] ?? '' : '',
    sortOrder: Number.parseInt(idxSort >= 0 ? row[idxSort] ?? '0' : '0', 10),
    isActive: parseBoolean(idxActive >= 0 ? row[idxActive] ?? '' : 'true', true),
  }));
}

export function parseProductsImportCsv(csv: string): ParsedProductImportRow[] {
  const records = parseCsvRecords(stripBom(csv));
  if (!records.length) return [];
  const [headers, ...rows] = records;
  const indexByHeader = new Map(headers.map((header, index) => [normalize(header), index]));

  const idxExternalCode = indexByHeader.get('externalcode') ?? indexByHeader.get('sku') ?? -1;
  const idxName = indexByHeader.get('name') ?? -1;
  const idxCategoryCode = indexByHeader.get('categorycode') ?? -1;
  const idxBasePrice = indexByHeader.get('baseprice') ?? -1;
  const idxActive = indexByHeader.get('isactive') ?? -1;
  const idxAvailable = indexByHeader.get('isavailable') ?? -1;
  const idxTracked = indexByHeader.get('isinventorytracked') ?? -1;
  const idxSubcategory = indexByHeader.get('subcategoryname') ?? -1;

  return rows.map((row, index) => ({
    lineNo: index + 1,
    externalCode: idxExternalCode >= 0 ? row[idxExternalCode] ?? '' : '',
    name: idxName >= 0 ? row[idxName] ?? '' : '',
    categoryCode: idxCategoryCode >= 0 ? row[idxCategoryCode] ?? '' : '',
    basePrice: Number.parseFloat(idxBasePrice >= 0 ? row[idxBasePrice] ?? '0' : '0'),
    isActive: parseBoolean(idxActive >= 0 ? row[idxActive] ?? '' : 'true', true),
    isAvailable: parseBoolean(idxAvailable >= 0 ? row[idxAvailable] ?? '' : 'true', true),
    isInventoryTracked: parseBoolean(idxTracked >= 0 ? row[idxTracked] ?? '' : 'false', false),
    subcategoryName: idxSubcategory >= 0 ? row[idxSubcategory] ?? '' : '',
  }));
}
