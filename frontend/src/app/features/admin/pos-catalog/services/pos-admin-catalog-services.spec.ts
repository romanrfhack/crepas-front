import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
import { ApiClient } from '../../../../core/services/api-client';
import { PosAdminCatalogAvailabilityApiService } from './pos-admin-catalog-availability-api.service';
import { PosAdminCatalogOverridesApiService } from './pos-admin-catalog-overrides-api.service';

describe('POS admin catalog services', () => {
  it('sends expected DTO payloads for overrides and availability', async () => {
    const calls: Array<{ method: string; path: string; body?: unknown }> = [];
    TestBed.configureTestingModule({
      providers: [
        PosAdminCatalogOverridesApiService,
        PosAdminCatalogAvailabilityApiService,
        {
          provide: ApiClient,
          useValue: {
            get: () => throwError(() => new Error('skip')),
            put: (path: string, body: unknown) => {
              calls.push({ method: 'put', path, body });
              return throwError(() => new Error('done'));
            },
          },
        },
      ],
    });

    const overrides = TestBed.inject(PosAdminCatalogOverridesApiService);
    const availability = TestBed.inject(PosAdminCatalogAvailabilityApiService);

    await expect(overrides.upsertOverride({ itemType: 'Product', itemId: 'item-1', isEnabled: true })).rejects.toBeTruthy();
    await expect(availability.upsertAvailability({ storeId: 'store-1', itemType: 'Extra', itemId: 'item-2', isAvailable: false })).rejects.toBeTruthy();

    expect(calls).toContainEqual({
      method: 'put',
      path: '/v1/pos/admin/catalog/overrides',
      body: { itemType: 'Product', itemId: 'item-1', isEnabled: true },
    });
    expect(calls).toContainEqual({
      method: 'put',
      path: '/v1/pos/admin/catalog/availability',
      body: { storeId: 'store-1', itemType: 'Extra', itemId: 'item-2', isAvailable: false },
    });
  });

  it('propagates backend 400 tenant required errors', async () => {
    const tenantRequired = { status: 400, error: { detail: 'tenantId required for this endpoint in platform mode' } };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        PosAdminCatalogOverridesApiService,
        {
          provide: ApiClient,
          useValue: {
            get: () => throwError(() => tenantRequired),
            put: () => throwError(() => tenantRequired),
          },
        },
      ],
    });

    const overrides = TestBed.inject(PosAdminCatalogOverridesApiService);
    await expect(overrides.upsertOverride({ itemType: 'Product', itemId: 'item-1', isEnabled: true })).rejects.toBe(tenantRequired);
  });
});
