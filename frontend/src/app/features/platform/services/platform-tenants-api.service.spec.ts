import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../../../core/services/api-client';
import { PlatformTenantsApiService } from './platform-tenants-api.service';

describe('PlatformTenantsApiService', () => {
  it('builds URLs and payloads for tenants crud', async () => {
    const calls: Array<{ method: string; path: string; body?: unknown }> = [];
    TestBed.configureTestingModule({
      providers: [
        PlatformTenantsApiService,
        {
          provide: ApiClient,
          useValue: {
            get: (path: string) => {
              calls.push({ method: 'get', path });
              return of([]);
            },
            post: (path: string, body: unknown) => {
              calls.push({ method: 'post', path, body });
              return of({});
            },
            put: (path: string, body: unknown) => {
              calls.push({ method: 'put', path, body });
              return of({});
            },
            delete: (path: string) => {
              calls.push({ method: 'delete', path });
              return of({});
            },
          },
        },
      ],
    });

    const service = TestBed.inject(PlatformTenantsApiService);
    const createPayload = { verticalId: 'v1', name: 'Tenant 1', slug: 'tenant-1', timeZoneId: 'America/Mexico_City' };
    const updatePayload = { verticalId: 'v2', name: 'Tenant 2', slug: 'tenant-2' };
    await service.listTenants();
    await service.createTenant(createPayload);
    await service.updateTenant('tenant-1', updatePayload);
    await service.deleteTenant('tenant-1');

    expect(calls.some((call) => call.method === 'get' && call.path === '/v1/platform/tenants')).toBe(true);
    expect(calls.some((call) => call.method === 'post' && call.path === '/v1/platform/tenants' && call.body === createPayload)).toBe(true);
    expect(calls.some((call) => call.method === 'put' && call.path === '/v1/platform/tenants/tenant-1' && call.body === updatePayload)).toBe(true);
    expect(calls.some((call) => call.method === 'delete' && call.path === '/v1/platform/tenants/tenant-1')).toBe(true);
  });
});
