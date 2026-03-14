import { parseCategoriesImportCsv, parseProductsImportCsv } from './catalog-import-csv.util';

describe('catalog-import-csv.util', () => {
  it('parsea categorías con alias y booleanos', () => {
    const rows = parseCategoriesImportCsv('\uFEFFcode,name,sort-order,isActive\nBEB,Bebidas,1,1');
    expect(rows[0]).toEqual({
      lineNo: 1,
      categoryCode: 'BEB',
      name: 'Bebidas',
      sortOrder: 1,
      isActive: true,
    });
  });

  it('parsea productos con sku y basePrice decimal', () => {
    const rows = parseProductsImportCsv('sku,name,categoryCode,basePrice,isAvailable,isInventoryTracked\nSKU-1,Latte,BEB,45.50,true,0');
    expect(rows[0].externalCode).toBe('SKU-1');
    expect(rows[0].basePrice).toBe(45.5);
    expect(rows[0].isAvailable).toBe(true);
    expect(rows[0].isInventoryTracked).toBe(false);
  });
});
