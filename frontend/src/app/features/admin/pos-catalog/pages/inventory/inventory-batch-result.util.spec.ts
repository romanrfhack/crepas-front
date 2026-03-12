import {
  buildFailedRowsCsv,
  filterBatchResultRows,
  groupFailedByErrorCode,
  InventoryBatchResultDisplayRow,
} from './inventory-batch-result.util';

function row(partial: Partial<InventoryBatchResultDisplayRow>): InventoryBatchResultDisplayRow {
  return {
    lineNo: 1,
    itemType: 'Product',
    externalCode: 'LAT-1',
    itemId: '',
    deltaQty: -1,
    status: 'Failed',
    errorCode: 'UNKNOWN_ITEM',
    message: 'error',
    qtyBefore: null,
    qtyAfter: null,
    deltaApplied: null,
    adjustmentId: '',
    ...partial,
  };
}

describe('inventory-batch-result.util', () => {
  it('genera errores.csv con header y escape correcto', () => {
    const csv = buildFailedRowsCsv([
      row({ lineNo: 2, externalCode: 'LAT,1', message: 'Item "X", no existe' }),
      row({
        lineNo: 3,
        itemType: 'Extra',
        externalCode: '',
        itemId: 'extra-1',
        errorCode: 'VALIDATION_ERROR',
        message: 'Delta inválido',
      }),
      row({ lineNo: 4, status: 'Applied', errorCode: '', message: '' }),
    ]);

    expect(csv).toBe(
      'lineNo,itemType,externalCode,itemId,deltaQty,errorCode,message\r\n' +
        '2,Product,"LAT,1",,-1,UNKNOWN_ITEM,"Item ""X"", no existe"\r\n' +
        '3,Extra,,extra-1,-1,VALIDATION_ERROR,Delta inválido\r\n',
    );
  });

  it('agrupa fallidas por errorCode', () => {
    const grouped = groupFailedByErrorCode([
      row({ errorCode: 'UNKNOWN_ITEM' }),
      row({ lineNo: 2, errorCode: 'UNKNOWN_ITEM' }),
      row({ lineNo: 3, errorCode: 'NEGATIVE_STOCK' }),
      row({ lineNo: 4, status: 'Applied', errorCode: '' }),
    ]);

    expect(grouped).toEqual({ UNKNOWN_ITEM: 2, NEGATIVE_STOCK: 1 });
  });

  it('filtra filas de resultados por All/Applied/Failed', () => {
    const rows = [
      row({ lineNo: 1, status: 'Applied', errorCode: '', message: '' }),
      row({ lineNo: 2, status: 'Failed' }),
    ];

    expect(filterBatchResultRows(rows, 'All')).toHaveLength(2);
    expect(filterBatchResultRows(rows, 'Applied')).toEqual([rows[0]]);
    expect(filterBatchResultRows(rows, 'Failed')).toEqual([rows[1]]);
  });
});
