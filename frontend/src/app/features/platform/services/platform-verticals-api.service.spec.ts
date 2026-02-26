import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../../../core/services/api-client';
import { PlatformVerticalsApiService } from './platform-verticals-api.service';

describe('PlatformVerticalsApiService', () => {
  it('builds URLs and payloads for verticals crud', async () => {
    const calls: Array<{ method: string; path: string; body?: unknown }> = [];
    TestBed.configureTestingModule({
      providers: [
        PlatformVerticalsApiService,
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

    const service = TestBed.inject(PlatformVerticalsApiService);
    const payload = { name: 'Retail', description: 'Shops' };
    await service.listVerticals();
    await service.createVertical(payload);
    await service.updateVertical('vertical-1', payload);
    await service.deleteVertical('vertical-1');

    expect(calls.some((call) => call.method === 'get' && call.path === '/v1/platform/verticals')).toBe(true);
    expect(calls.some((call) => call.method === 'post' && call.path === '/v1/platform/verticals' && call.body === payload)).toBe(true);
    expect(calls.some((call) => call.method === 'put' && call.path === '/v1/platform/verticals/vertical-1' && call.body === payload)).toBe(true);
    expect(calls.some((call) => call.method === 'delete' && call.path === '/v1/platform/verticals/vertical-1')).toBe(true);
  });
});
