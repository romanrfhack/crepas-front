import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PosShiftApiService } from './pos-shift-api.service';
import { StoreContextService } from './store-context.service';

describe('PosShiftApiService', () => {
  it('returns null when current shift endpoint responds with 204', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        PosShiftApiService,
        {
          provide: StoreContextService,
          useValue: {
            getActiveStoreId: () => null,
          },
        },
      ],
    });

    const service = TestBed.inject(PosShiftApiService);
    const httpMock = TestBed.inject(HttpTestingController);

    const promise = service.getCurrentShift();

    const req = httpMock.expectOne('/api/v1/pos/shifts/current');
    expect(req.request.method).toBe('GET');
    req.flush(null, { status: 204, statusText: 'No Content' });

    const result = await promise;
    expect(result).toBeNull();
    httpMock.verify();
  });

  it('maps closePreviewV2 request with store and cashCount values', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        PosShiftApiService,
        {
          provide: StoreContextService,
          useValue: {
            getActiveStoreId: () => 'store-123',
          },
        },
      ],
    });

    const service = TestBed.inject(PosShiftApiService);
    const httpMock = TestBed.inject(HttpTestingController);

    const promise = service.closePreviewV2({
      shiftId: 'shift-1',
      cashCount: [{ denominationValue: 100, count: 2 }],
    });

    const req = httpMock.expectOne('/api/v1/pos/shifts/close-preview');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      shiftId: 'shift-1',
      cashCount: [{ denominationValue: 100, count: 2 }],
      storeId: 'store-123',
    });

    req.flush({
      shiftId: 'shift-1',
      openedAtUtc: '2026-02-12T10:00:00Z',
      openingCashAmount: 100,
      salesCashTotal: 250,
      expectedCashAmount: 350,
      countedCashAmount: 350,
      difference: 0,
      breakdown: {
        cashAmount: 250,
        cardAmount: 50,
        transferAmount: 30,
        totalSalesCount: 7,
      },
    });

    const preview = await promise;
    expect(preview.breakdown?.cardAmount).toBe(50);
    httpMock.verify();
  });

  it('applies breakdown fallback when response omits breakdown', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        PosShiftApiService,
        {
          provide: StoreContextService,
          useValue: {
            getActiveStoreId: () => null,
          },
        },
      ],
    });

    const service = TestBed.inject(PosShiftApiService);
    const httpMock = TestBed.inject(HttpTestingController);

    const promise = service.closePreviewV2({ shiftId: 'shift-1' });

    const req = httpMock.expectOne('/api/v1/pos/shifts/close-preview');
    req.flush({
      shiftId: 'shift-1',
      openedAtUtc: '2026-02-12T10:00:00Z',
      openingCashAmount: 100,
      salesCashTotal: 250,
      expectedCashAmount: 350,
    });

    const preview = await promise;
    expect(preview.breakdown).toEqual({
      cashAmount: 250,
      cardAmount: 0,
      transferAmount: 0,
      totalSalesCount: 0,
    });
    expect(preview.countedCashAmount).toBeNull();
    expect(preview.difference).toBeNull();
    httpMock.verify();
  });
});
