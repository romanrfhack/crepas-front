import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../../../core/services/api-client';
import { PlatformCatalogTemplatesApiService } from './platform-catalog-templates-api.service';

describe('PlatformCatalogTemplatesApiService', () => {
  it('builds URLs and payloads for list/create/update/assign', async () => {
    const calls: Array<{ method: string; path: string; body?: unknown }> = [];
    TestBed.configureTestingModule({
      providers: [
        PlatformCatalogTemplatesApiService,
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
          },
        },
      ],
    });

    const service = TestBed.inject(PlatformCatalogTemplatesApiService);
    await service.listTemplates('vertical-1');
    await service.createTemplate({ verticalId: 'v1', name: 'Template A', version: '1.0', isActive: true });
    await service.updateTemplate('template-id', { verticalId: 'v1', name: 'Template A', version: '1.1' });
    await service.assignTemplateToTenant('tenant-1', { catalogTemplateId: 'template-id' });

    expect(calls.some((call) => call.method === 'get' && call.path === '/v1/platform/catalog-templates?verticalId=vertical-1')).toBe(true);
    expect(calls.some((call) => call.method === 'post' && call.path === '/v1/platform/catalog-templates')).toBe(true);
    expect(calls.some((call) => call.method === 'put' && call.path === '/v1/platform/catalog-templates/template-id')).toBe(true);
    expect(calls.some((call) => call.method === 'put' && call.path === '/v1/platform/catalog-templates/tenants/tenant-1')).toBe(true);
  });
});
