import { parseDeltaQty, parseInventoryImportCsv } from './inventory-import-csv.util';

describe('inventory-import-csv.util', () => {
  it('remueve BOM y reconoce headers obligatorios', () => {
    const csv =
      '\uFEFFstoreId,itemType,externalCode,deltaQty,reasonCode\nstore-1,Product,LAT-1,10.5,Correction';

    const result = parseInventoryImportCsv(csv);

    expect(result.missingRequiredColumns).toEqual([]);
    expect(result.rows[0].storeId).toBe('store-1');
    expect(result.rows[0].externalCode).toBe('LAT-1');
  });

  it('normaliza casing/espacios en headers', () => {
    const csv =
      ' store id , item type , External Code , DELTA QTY , reason code \nstore-1,Product,LAT-1,10.5,Correction';

    const result = parseInventoryImportCsv(csv);

    expect(result.missingRequiredColumns).toEqual([]);
    expect(result.rows[0].externalCode).toBe('LAT-1');
    expect(result.rows[0].deltaQty).toBe('10.5');
  });

  it('parsea CRLF y LF de forma equivalente', () => {
    const lf =
      'storeId,itemType,externalCode,deltaQty,reasonCode\nstore-1,Product,LAT-1,1,Correction';
    const crlf =
      'storeId,itemType,externalCode,deltaQty,reasonCode\r\nstore-1,Product,LAT-1,1,Correction';

    const lfResult = parseInventoryImportCsv(lf);
    const crlfResult = parseInventoryImportCsv(crlf);

    expect(lfResult).toEqual(crlfResult);
  });

  it('ignora columnas desconocidas sin fallar', () => {
    const csv =
      'storeId,itemType,externalCode,deltaQty,reasonCode,unusedColumn\nstore-1,Product,LAT-1,1,Correction,algo';

    const result = parseInventoryImportCsv(csv);

    expect(result.missingRequiredColumns).toEqual([]);
    expect(result.rows[0].externalCode).toBe('LAT-1');
  });

  it('reporta columnas obligatorias faltantes', () => {
    const csv = 'storeId,itemType,externalCode\nstore-1,Product,LAT-1';

    const result = parseInventoryImportCsv(csv);

    expect(result.missingRequiredColumns).toEqual(['deltaQty', 'reasonCode']);
  });

  it('rechaza deltaQty con coma decimal con mensaje explícito', () => {
    const result = parseDeltaQty('10,5');

    expect(result.value).toBeNull();
    expect(result.error).toContain('DeltaQty usa coma decimal');
  });

  it('acepta deltaQty con punto decimal', () => {
    expect(parseDeltaQty('10').value).toBe(10);
    expect(parseDeltaQty('10.5').value).toBe(10.5);
    expect(parseDeltaQty('-2.250').value).toBe(-2.25);
  });

  it('parsea campos quoted con comas y comillas', () => {
    const csv =
      'storeId,itemType,externalCode,deltaQty,reasonCode,note\nstore-1,Product,LAT-1,1.5,Correction,"nota con, coma y ""comillas"""';

    const result = parseInventoryImportCsv(csv);

    expect(result.rows[0].note).toBe('nota con, coma y "comillas"');
  });
});
