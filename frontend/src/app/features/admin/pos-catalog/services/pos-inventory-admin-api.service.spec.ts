import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { ApiClient } from '../../../../core/services/api-client';
import { PosInventoryAdminApiService } from './pos-inventory-admin-api.service';

describe('PosInventoryAdminApiService', () => {
  it('builds expected urls and payloads for inventory release C endpoints', async () => {
    const calls: Array<{ method: 'get' | 'put'; path: string; body?: unknown }> = [];
    const apiClientMock = {
      get: (path: string): Observable<unknown> => {
        calls.push({ method: 'get', path });
        return of([]);
      },
      put: (path: string, body: unknown): Observable<unknown> => {
        calls.push({ method: 'put', path, body });
        return of({});
      },
    };

    TestBed.configureTestingModule({
      providers: [PosInventoryAdminApiService, { provide: ApiClient, useValue: apiClientMock }],
    });

    const service = TestBed.inject(PosInventoryAdminApiService);
    await service.listInventory('store-1');
    await service.listInventory('store-1', 'latte');
    await service.listInventory('store-1', 'latte', true);
    await service.upsertInventory({ storeId: 'store-1', productId: 'product-1', onHand: 9 });
    await service.updateInventorySettings({ showOnlyInStock: true });

    expect(calls).toContainEqual({ method: 'get', path: '/v1/pos/admin/inventory?storeId=store-1' });
    expect(calls).toContainEqual({ method: 'get', path: '/v1/pos/admin/inventory?storeId=store-1&search=latte' });
    expect(calls).toContainEqual({ method: 'get', path: '/v1/pos/admin/inventory?storeId=store-1&search=latte&onlyWithStock=true' });
    expect(calls).toContainEqual({
      method: 'put',
      path: '/v1/pos/admin/inventory',
      body: { storeId: 'store-1', productId: 'product-1', onHand: 9 },
    });
    expect(calls).toContainEqual({
      method: 'put',
      path: '/v1/pos/admin/inventory/settings',
      body: { showOnlyInStock: true },
    });
  });
});
