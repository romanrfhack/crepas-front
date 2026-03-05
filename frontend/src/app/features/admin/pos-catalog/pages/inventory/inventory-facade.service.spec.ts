import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { PosInventoryAdminApiService } from '../../services/pos-inventory-admin-api.service';
import { InventoryFacadeService } from './inventory-facade.service';

describe('InventoryFacadeService', () => {
  it('builds query with filters and handles debounce search', fakeAsync(async () => {
    const listInventoryV2 = vi.fn().mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 10 });
    TestBed.configureTestingModule({
      providers: [InventoryFacadeService, { provide: PosInventoryAdminApiService, useValue: { listInventoryV2 } }],
    });

    const service = TestBed.inject(InventoryFacadeService);
    service.updateStore('store-1');
    service.updateTracked('true');
    service.updateCategory('cat-1');
    service.updateSearch(' latte ');
    tick(350);
    await service.load();

    expect(listInventoryV2).toHaveBeenCalledWith({
      storeId: 'store-1',
      q: 'latte',
      categoryId: 'cat-1',
      tracked: true,
      page: 1,
      pageSize: 10,
    });
  }));

  it('sets error message when API fails', async () => {
    const listInventoryV2 = vi.fn().mockRejectedValue(new Error('boom'));
    TestBed.configureTestingModule({
      providers: [InventoryFacadeService, { provide: PosInventoryAdminApiService, useValue: { listInventoryV2 } }],
    });

    const service = TestBed.inject(InventoryFacadeService);
    service.updateStore('store-1');
    await service.load();

    expect(service.error()).toContain('No fue posible cargar inventario');
  });
});
