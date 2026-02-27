import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { StoreContextService } from './store-context.service';
import { PosCatalogSnapshotService } from './pos-catalog-snapshot.service';

const snapshotFixture = {
  storeId: 'store-1',
  timeZoneId: 'America/Mexico_City',
  generatedAtUtc: '2026-01-01T00:00:00Z',
  catalogVersion: 'v1',
  etagSeed: 'seed',
  categories: [],
  products: [],
  optionSets: [],
  optionItems: [],
  schemas: [],
  selectionGroups: [],
  extras: [],
  includedItems: [],
  overrides: [],
  versionStamp: 'stamp',
};

describe('PosCatalogSnapshotService', () => {
  let service: PosCatalogSnapshotService;
  let storeContext: StoreContextService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('pos_active_store_id', 'context-store');

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PosCatalogSnapshotService, StoreContextService],
    });

    service = TestBed.inject(PosCatalogSnapshotService);
    storeContext = TestBed.inject(StoreContextService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('stores ETag on 200 and sends If-None-Match on next request', async () => {
    const first = firstValueFrom(service.getSnapshot({ storeId: 'store-1' }));
    const req1 = httpMock.expectOne(
      `${environment.apiBaseUrl}/v1/pos/catalog/snapshot?storeId=store-1`,
    );
    expect(req1.request.headers.has('If-None-Match')).toBe(false);
    req1.flush(snapshotFixture, {
      status: 200,
      statusText: 'OK',
      headers: { ETag: '"abc"' },
    });
    await first;

    const second = firstValueFrom(service.getSnapshot({ storeId: 'store-1' }));
    const req2 = httpMock.expectOne(
      `${environment.apiBaseUrl}/v1/pos/catalog/snapshot?storeId=store-1`,
    );
    expect(req2.request.headers.get('If-None-Match')).toBe('"abc"');
    req2.flush(snapshotFixture, { status: 200, statusText: 'OK' });
    await second;
  });

  it('returns cached snapshot when server responds 304', async () => {
    const prime = firstValueFrom(service.getSnapshot({ storeId: 'store-1' }));
    const req1 = httpMock.expectOne(
      `${environment.apiBaseUrl}/v1/pos/catalog/snapshot?storeId=store-1`,
    );
    req1.flush(snapshotFixture, {
      status: 200,
      statusText: 'OK',
      headers: { ETag: '"abc"' },
    });
    await prime;

    const getCached = firstValueFrom(service.getSnapshot({ storeId: 'store-1' }));
    const req2 = httpMock.expectOne(
      `${environment.apiBaseUrl}/v1/pos/catalog/snapshot?storeId=store-1`,
    );
    req2.flush('', { status: 304, statusText: 'Not Modified' });

    await expect(getCached).resolves.toEqual(snapshotFixture);
  });

  it('uses storeId priority explicit > context > omitted', async () => {
    const explicit = firstValueFrom(service.getSnapshot({ storeId: 'explicit-store' }));
    const explicitReq = httpMock.expectOne(
      `${environment.apiBaseUrl}/v1/pos/catalog/snapshot?storeId=explicit-store`,
    );
    explicitReq.flush(snapshotFixture, { status: 200, statusText: 'OK' });
    await explicit;

    const context = firstValueFrom(service.getSnapshot());
    const contextReq = httpMock.expectOne(
      `${environment.apiBaseUrl}/v1/pos/catalog/snapshot?storeId=context-store`,
    );
    contextReq.flush(snapshotFixture, { status: 200, statusText: 'OK' });
    await context;

    storeContext.setActiveStoreId(null);

    const omitted = firstValueFrom(service.getSnapshot());
    const omittedReq = httpMock.expectOne(`${environment.apiBaseUrl}/v1/pos/catalog/snapshot`);
    omittedReq.flush(snapshotFixture, { status: 200, statusText: 'OK' });
    await omitted;
  });

  it('invalidates previous store cache and refetches when active store changes', async () => {
    const first = firstValueFrom(service.getSnapshot());
    const firstReq = httpMock.expectOne(
      `${environment.apiBaseUrl}/v1/pos/catalog/snapshot?storeId=context-store`,
    );
    firstReq.flush(snapshotFixture, {
      status: 200,
      statusText: 'OK',
      headers: { ETag: '"etag-context-store"' },
    });
    await first;

    const cachedEntryKey = 'pos_catalog_snapshot_cache:context-store';
    expect(localStorage.getItem(cachedEntryKey)).toContain('etag-context-store');

    storeContext.setActiveStoreId('store-2');
    TestBed.flushEffects();

    expect(localStorage.getItem(cachedEntryKey)).toBeNull();

    const second = firstValueFrom(service.getSnapshot());
    const secondReq = httpMock.expectOne(
      `${environment.apiBaseUrl}/v1/pos/catalog/snapshot?storeId=store-2`,
    );
    expect(secondReq.request.headers.has('If-None-Match')).toBe(false);
    secondReq.flush({ ...snapshotFixture, storeId: 'store-2' }, { status: 200, statusText: 'OK' });
    await second;
  });

  it('retries without storeId when API reports multi-store disabled', async () => {
    const request = firstValueFrom(service.getSnapshot());
    const scopedReq = httpMock.expectOne(
      `${environment.apiBaseUrl}/v1/pos/catalog/snapshot?storeId=context-store`,
    );
    scopedReq.flush(
      {
        errors: {
          storeId: ['Multi-store is disabled.'],
        },
      },
      { status: 400, statusText: 'Bad Request' },
    );

    const fallbackReq = httpMock.expectOne(`${environment.apiBaseUrl}/v1/pos/catalog/snapshot`);
    fallbackReq.flush(snapshotFixture, { status: 200, statusText: 'OK' });

    await expect(request).resolves.toEqual(snapshotFixture);
    expect(storeContext.getActiveStoreId()).toBeNull();
  });
});
