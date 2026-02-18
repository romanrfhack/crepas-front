import { of } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { ApiClient } from '../../../core/services/api-client';
import { PosReportsApiService } from './pos-reports-api.service';
import { StoreContextService } from './store-context.service';

describe('PosReportsApiService', () => {
  it('builds daily sales url with date range and active store id', async () => {
    const getSpy = vi.fn().mockReturnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        PosReportsApiService,
        { provide: ApiClient, useValue: { get: getSpy } },
        { provide: StoreContextService, useValue: { getActiveStoreId: () => 'store-1' } },
      ],
    });

    const service = TestBed.inject(PosReportsApiService);

    await service.getDailySales({ dateFrom: '2026-03-01', dateTo: '2026-03-07' });

    expect(getSpy).toHaveBeenCalledWith(
      '/v1/pos/reports/sales/daily?dateFrom=2026-03-01&dateTo=2026-03-07&storeId=store-1',
    );
  });

  it('builds hourly sales url with explicit filters', async () => {
    const getSpy = vi.fn().mockReturnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        PosReportsApiService,
        { provide: ApiClient, useValue: { get: getSpy } },
        { provide: StoreContextService, useValue: { getActiveStoreId: () => null } },
      ],
    });

    const service = TestBed.inject(PosReportsApiService);

    await service.getHourlySales({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-07',
      storeId: 'store-2',
      cashierUserId: 'cashier-1',
      shiftId: 'shift-1',
    });

    expect(getSpy).toHaveBeenCalledWith(
      '/v1/pos/reports/sales/hourly?dateFrom=2026-03-01&dateTo=2026-03-07&storeId=store-2&cashierUserId=cashier-1&shiftId=shift-1',
    );
  });

  it('builds payments url and keeps provided storeId over context', async () => {
    const getSpy = vi
      .fn()
      .mockReturnValue(of({ dateFrom: '2026-03-01', dateTo: '2026-03-07', totals: [] }));

    TestBed.configureTestingModule({
      providers: [
        PosReportsApiService,
        { provide: ApiClient, useValue: { get: getSpy } },
        { provide: StoreContextService, useValue: { getActiveStoreId: () => 'store-context' } },
      ],
    });

    const service = TestBed.inject(PosReportsApiService);

    await service.getPaymentsByMethod({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-07',
      storeId: 'store-explicit',
    });

    expect(getSpy).toHaveBeenCalledWith(
      '/v1/pos/reports/payments/methods?dateFrom=2026-03-01&dateTo=2026-03-07&storeId=store-explicit',
    );
  });
});
