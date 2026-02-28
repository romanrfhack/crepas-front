import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../../../core/services/api-client';
import { PlatformStoresApiService } from './platform-stores-api.service';

describe('PlatformStoresApiService', () => {
  it('uses platform stores admin v1 endpoints with expected payloads', async () => {
    const calls: Array<{ method: string; path: string; body?: unknown }> = [];

    TestBed.configureTestingModule({
      providers: [
        PlatformStoresApiService,
        {
          provide: ApiClient,
          useValue: {
            get: (path: string) => {
              calls.push({ method: 'get', path });
              return of({});
            },
            put: (path: string, body: unknown) => {
              calls.push({ method: 'put', path, body });
              return of({});
            },
          },
        },
      ],
    });

    const service = TestBed.inject(PlatformStoresApiService);
    const updatePayload = { name: 'Centro', timeZoneId: 'UTC', isActive: true };
    const defaultPayload = { defaultStoreId: 'store-2' };

    await service.getTenantStores('tenant-1');
    await service.getStoreDetails('store-1');
    await service.updateStore('store-1', updatePayload);
    await service.updateTenantDefaultStore('tenant-1', defaultPayload);

    expect(calls.some((call) => call.method === 'get' && call.path === '/v1/platform/tenants/tenant-1/stores')).toBe(true);
    expect(calls.some((call) => call.method === 'get' && call.path === '/v1/platform/stores/store-1')).toBe(true);
    expect(calls.some((call) => call.method === 'put' && call.path === '/v1/platform/stores/store-1' && call.body === updatePayload)).toBe(true);
    expect(calls.some((call) => call.method === 'put' && call.path === '/v1/platform/tenants/tenant-1/default-store' && call.body === defaultPayload)).toBe(true);
  });
});
