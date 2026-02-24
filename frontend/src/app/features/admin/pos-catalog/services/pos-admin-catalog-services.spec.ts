import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
import { ApiClient } from '../../../../core/services/api-client';
import { PosAdminCatalogAvailabilityApiService } from './pos-admin-catalog-availability-api.service';
import { PosAdminCatalogOverridesApiService } from './pos-admin-catalog-overrides-api.service';

describe('POS admin catalog services', () => {
  it('builds query params and payloads for store overrides CRUD', async () => {
    const calls: Array<{ method: string; path: string; body?: unknown }> = [];
    TestBed.configureTestingModule({
      providers: [
        PosAdminCatalogOverridesApiService,
        PosAdminCatalogAvailabilityApiService,
        {
          provide: ApiClient,
          useValue: {
            get: (path: string) => {
              calls.push({ method: 'get', path });
              return throwError(() => new Error('skip'));
            },
            put: (path: string, body: unknown) => {
              calls.push({ method: 'put', path, body });
              return throwError(() => new Error('done'));
            },
            delete: (path: string) => {
              calls.push({ method: 'delete', path });
              return throwError(() => new Error('done'));
            },
          },
        },
      ],
    });

    const overrides = TestBed.inject(PosAdminCatalogOverridesApiService);
    const availability = TestBed.inject(PosAdminCatalogAvailabilityApiService);

    await expect(overrides.listOverrides('store-1', 'Product')).rejects.toBeTruthy();
    await expect(overrides.listOverrides('store-1', undefined, false)).rejects.toBeTruthy();
    await expect(
      overrides.upsertOverride({ storeId: 'store-1', itemType: 'Product', itemId: 'item-1', state: 'Enabled' }),
    ).rejects.toBeTruthy();
    await expect(
      overrides.upsertOverride({ storeId: 'store-1', itemType: 'Extra', itemId: 'item-2', state: 'Disabled' }),
    ).rejects.toBeTruthy();
    await expect(overrides.deleteOverride('store-1', 'Product', 'item-1')).rejects.toBeTruthy();
    await expect(
      availability.upsertAvailability({ storeId: 'store-1', itemType: 'Extra', itemId: 'item-2', isAvailable: false }),
    ).rejects.toBeTruthy();

    expect(calls).toContainEqual({
      method: 'get',
      path: '/v1/pos/admin/catalog/store-overrides?storeId=store-1&onlyOverrides=true&itemType=Product',
    });
    expect(calls).toContainEqual({
      method: 'get',
      path: '/v1/pos/admin/catalog/store-overrides?storeId=store-1&onlyOverrides=false',
    });
    expect(calls).toContainEqual({
      method: 'put',
      path: '/v1/pos/admin/catalog/store-overrides',
      body: { storeId: 'store-1', itemType: 'Product', itemId: 'item-1', state: 'Enabled' },
    });
    expect(calls).toContainEqual({
      method: 'put',
      path: '/v1/pos/admin/catalog/store-overrides',
      body: { storeId: 'store-1', itemType: 'Extra', itemId: 'item-2', state: 'Disabled' },
    });
    expect(calls).toContainEqual({
      method: 'delete',
      path: '/v1/pos/admin/catalog/store-overrides?storeId=store-1&itemType=Product&itemId=item-1',
    });
    expect(calls).toContainEqual({
      method: 'put',
      path: '/v1/pos/admin/catalog/availability',
      body: { storeId: 'store-1', itemType: 'Extra', itemId: 'item-2', isAvailable: false },
    });
  });
});
