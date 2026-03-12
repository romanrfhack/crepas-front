import { TestBed } from '@angular/core/testing';
import { PosInventoryAdminApiService } from '../../services/pos-inventory-admin-api.service';
import { InventoryFacadeService } from './inventory-facade.service';

describe('InventoryFacadeService', () => {
  it('builds query with filters and handles debounce search', async () => {
    vi.useFakeTimers();
    const listInventoryV2 = vi.fn().mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 10 });
    TestBed.configureTestingModule({
      providers: [InventoryFacadeService, { provide: PosInventoryAdminApiService, useValue: { listInventoryV2, listInventoryMovementsV2: vi.fn() } }],
    });

    const service = TestBed.inject(InventoryFacadeService);
    service.updateStore('store-1');
    service.updateTracked('true');
    service.updateCategory('cat-1');
    service.updateSearch(' latte ');
    await vi.advanceTimersByTimeAsync(350);
    await service.load();

    expect(listInventoryV2).toHaveBeenCalledWith({
      storeId: 'store-1',
      q: 'latte',
      categoryId: 'cat-1',
      tracked: true,
      page: 1,
      pageSize: 10,
    });
    vi.useRealTimers();
  });

  it('loads movements with expected query and supports paging', async () => {
    const listInventoryMovementsV2 = vi.fn().mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 10 });
    TestBed.configureTestingModule({
      providers: [InventoryFacadeService, { provide: PosInventoryAdminApiService, useValue: { listInventoryV2: vi.fn().mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 10 }), listInventoryMovementsV2 } }],
    });

    const service = TestBed.inject(InventoryFacadeService);
    service.openMovementsDrawer({ storeId: 'store-1', itemType: 'Product', itemId: 'product-1', itemName: 'Latte', itemSku: 'LAT-1', onHandQty: 5 });
    service.updateMovementsReason('Correction');
    service.updateMovementsReference('sale-1');
    await new Promise((resolve) => setTimeout(resolve, 350));
    service.updateMovementsPage(2);
    await service.loadMovements();

    expect(listInventoryMovementsV2).toHaveBeenLastCalledWith({
      storeId: 'store-1',
      itemType: 'Product',
      itemId: 'product-1',
      reason: 'Correction',
      referenceId: 'sale-1',
      page: 2,
      pageSize: 10,
      from: undefined,
      to: undefined,
    });
  });

  it('sets error message when API fails', async () => {
    const listInventoryV2 = vi.fn().mockRejectedValue(new Error('boom'));
    TestBed.configureTestingModule({
      providers: [InventoryFacadeService, { provide: PosInventoryAdminApiService, useValue: { listInventoryV2, listInventoryMovementsV2: vi.fn() } }],
    });

    const service = TestBed.inject(InventoryFacadeService);
    service.updateStore('store-1');
    await service.load();

    expect(service.error()).toContain('No fue posible cargar inventario');
  });
});
