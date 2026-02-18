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
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        PosCatalogSnapshotService,
        {
          provide: StoreContextService,
          useValue: {
            getActiveStoreId: () => 'context-store',
          },
        },
      ],
    });

    service = TestBed.inject(PosCatalogSnapshotService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('stores ETag on 200 and sends If-None-Match on next request', async () => {
    const first = firstValueFrom(service.getSnapshot({ storeId: 'store-1' }));
    const req1 = httpMock.expectOne(`${environment.apiBaseUrl}/v1/pos/catalog/snapshot?storeId=store-1`);
    expect(req1.request.headers.has('If-None-Match')).toBe(false);
    req1.flush(snapshotFixture, {
      status: 200,
      statusText: 'OK',
      headers: { ETag: '"abc"' },
    });
    await first;

    const second = firstValueFrom(service.getSnapshot({ storeId: 'store-1' }));
    const req2 = httpMock.expectOne(`${environment.apiBaseUrl}/v1/pos/catalog/snapshot?storeId=store-1`);
    expect(req2.request.headers.get('If-None-Match')).toBe('"abc"');
    req2.flush(snapshotFixture, { status: 200, statusText: 'OK' });
    await second;
  });

  it('returns cached snapshot when server responds 304', async () => {
    const prime = firstValueFrom(service.getSnapshot({ storeId: 'store-1' }));
    const req1 = httpMock.expectOne(`${environment.apiBaseUrl}/v1/pos/catalog/snapshot?storeId=store-1`);
    req1.flush(snapshotFixture, {
      status: 200,
      statusText: 'OK',
      headers: { ETag: '"abc"' },
    });
    await prime;

    const getCached = firstValueFrom(service.getSnapshot({ storeId: 'store-1' }));
    const req2 = httpMock.expectOne(`${environment.apiBaseUrl}/v1/pos/catalog/snapshot?storeId=store-1`);
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

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        PosCatalogSnapshotService,
        { provide: StoreContextService, useValue: { getActiveStoreId: () => null } },
      ],
    });
    const withoutStoreService = TestBed.inject(PosCatalogSnapshotService);
    const withoutStoreHttpMock = TestBed.inject(HttpTestingController);

    const omitted = firstValueFrom(withoutStoreService.getSnapshot());
    const omittedReq = withoutStoreHttpMock.expectOne(
      `${environment.apiBaseUrl}/v1/pos/catalog/snapshot`,
    );
    omittedReq.flush(snapshotFixture, { status: 200, statusText: 'OK' });
    await omitted;
    withoutStoreHttpMock.verify();
  });
});
