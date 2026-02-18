import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { ApiClient } from '../../../../core/services/api-client';
import { PosCatalogApiService } from './pos-catalog-api.service';

interface ApiCall {
  method: 'get' | 'post' | 'put' | 'delete';
  path: string;
  body?: unknown;
}

describe('PosCatalogApiService', () => {
  it('should build expected URLs for CRUD endpoints', async () => {
    const calls: ApiCall[] = [];
    const apiClientMock = {
      get: (path: string): Observable<unknown> => {
        calls.push({ method: 'get', path });
        return of([]);
      },
      post: (path: string, body: unknown): Observable<unknown> => {
        calls.push({ method: 'post', path, body });
        return of({});
      },
      put: (path: string, body: unknown): Observable<unknown> => {
        calls.push({ method: 'put', path, body });
        return of({});
      },
      delete: (path: string): Observable<unknown> => {
        calls.push({ method: 'delete', path });
        return of(void 0);
      },
    };

    TestBed.configureTestingModule({
      providers: [
        PosCatalogApiService,
        {
          provide: ApiClient,
          useValue: apiClientMock,
        },
      ],
    });

    const service = TestBed.inject(PosCatalogApiService);

    await service.getCategories(true);
    await service.createProduct({
      externalCode: null,
      name: 'Producto',
      categoryId: 'category-id',
      subcategoryName: null,
      basePrice: 10,
      isActive: true,
      isAvailable: true,
      customizationSchemaId: null,
    });
    await service.getOptionItems('set-id', true);
    await service.replaceIncludedItems('product-id', { items: [{ extraId: 'extra-id', quantity: 1 }] });
    await service.upsertOverride('product-id', 'group key', { allowedOptionItemIds: ['item-id'] });

    expect(calls.some((call) => call.method === 'get' && call.path === '/v1/pos/admin/categories?includeInactive=true')).toBe(true);
    expect(calls.some((call) => call.method === 'post' && call.path === '/v1/pos/admin/products')).toBe(true);
    expect(calls.some((call) => call.method === 'get' && call.path === '/v1/pos/admin/option-sets/set-id/items?includeInactive=true')).toBe(true);
    expect(calls.some((call) => call.method === 'put' && call.path === '/v1/pos/admin/products/product-id/included-items')).toBe(true);
    expect(calls.some((call) => call.method === 'put' && call.path === '/v1/pos/admin/products/product-id/overrides/group%20key')).toBe(true);
  });

  it('includes isAvailable in create/update payloads for product, extra and option item', async () => {
    const calls: ApiCall[] = [];
    const apiClientMock = {
      get: () => of([]),
      post: (path: string, body: unknown): Observable<unknown> => {
        calls.push({ method: 'post', path, body });
        return of({});
      },
      put: (path: string, body: unknown): Observable<unknown> => {
        calls.push({ method: 'put', path, body });
        return of({});
      },
      delete: () => of(void 0),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        PosCatalogApiService,
        {
          provide: ApiClient,
          useValue: apiClientMock,
        },
      ],
    });

    const service = TestBed.inject(PosCatalogApiService);
    await service.createExtra({ name: 'Extra', price: 5, isActive: true, isAvailable: false });
    await service.updateProduct('p1', {
      externalCode: null,
      name: 'P',
      categoryId: 'c1',
      subcategoryName: null,
      basePrice: 10,
      isActive: true,
      isAvailable: false,
      customizationSchemaId: null,
    });
    await service.updateOptionItem('set1', 'item1', {
      name: 'Item',
      sortOrder: 1,
      isActive: true,
      isAvailable: false,
    });

    expect(calls.every((call) => {
      if (call.path.includes('/products') || call.path.includes('/extras') || call.path.includes('/items')) {
        const body = call.body as Record<string, unknown>;
        return typeof body['isAvailable'] === 'boolean';
      }
      return true;
    })).toBe(true);
  });
});
