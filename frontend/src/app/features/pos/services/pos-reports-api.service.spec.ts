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

  it('builds v2 routes with cashier and shift filters when supported', async () => {
    const getSpy = vi.fn().mockReturnValue(of({ items: [] }));

    TestBed.configureTestingModule({
      providers: [
        PosReportsApiService,
        { provide: ApiClient, useValue: { get: getSpy } },
        { provide: StoreContextService, useValue: { getActiveStoreId: () => 'store-context' } },
      ],
    });

    const service = TestBed.inject(PosReportsApiService);

    await service.getSalesMixByProducts({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-07',
      cashierUserId: 'cashier-2',
      shiftId: 'shift-2',
      top: 20,
    });

    expect(getSpy).toHaveBeenCalledWith(
      '/v1/pos/reports/sales/products?dateFrom=2026-03-01&dateTo=2026-03-07&cashierUserId=cashier-2&shiftId=shift-2&top=20&storeId=store-context',
    );
  });

  it('omits shiftId for cash differences and keeps explicit store priority', async () => {
    const getSpy = vi.fn().mockReturnValue(of({ daily: [], shifts: [] }));

    TestBed.configureTestingModule({
      providers: [
        PosReportsApiService,
        { provide: ApiClient, useValue: { get: getSpy } },
        { provide: StoreContextService, useValue: { getActiveStoreId: () => 'store-context' } },
      ],
    });

    const service = TestBed.inject(PosReportsApiService);

    await service.getCashDifferencesControl({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-07',
      cashierUserId: 'cashier-2',
      storeId: 'store-explicit',
    });

    expect(getSpy).toHaveBeenCalledWith(
      '/v1/pos/reports/control/cash-differences?dateFrom=2026-03-01&dateTo=2026-03-07&cashierUserId=cashier-2&storeId=store-explicit',
    );
  });

  it('keeps iso-like date text unchanged in query', async () => {
    const getSpy = vi.fn().mockReturnValue(
      of({
        tickets: 0,
        totalItems: 0,
        grossSales: 0,
        avgTicket: 0,
        avgItemsPerTicket: 0,
        voidCount: 0,
        voidRate: 0,
      }),
    );

    TestBed.configureTestingModule({
      providers: [
        PosReportsApiService,
        { provide: ApiClient, useValue: { get: getSpy } },
        { provide: StoreContextService, useValue: { getActiveStoreId: () => null } },
      ],
    });

    const service = TestBed.inject(PosReportsApiService);

    await service.getKpisSummary({
      dateFrom: '2026-03-01T00:00:00.000Z',
      dateTo: '2026-03-07T23:59:59.999Z',
    });

    expect(getSpy).toHaveBeenCalledWith(
      '/v1/pos/reports/kpis/summary?dateFrom=2026-03-01T00%3A00%3A00.000Z&dateTo=2026-03-07T23%3A59%3A59.999Z',
    );
  });

  it('builds inventory report routes with threshold and contextual store', async () => {
    const getSpy = vi.fn().mockReturnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        PosReportsApiService,
        { provide: ApiClient, useValue: { get: getSpy } },
        { provide: StoreContextService, useValue: { getActiveStoreId: () => 'store-context' } },
      ],
    });

    const service = TestBed.inject(PosReportsApiService);
    await service.inventoryCurrent({ itemType: 'Product', search: 'latte' });
    await service.inventoryLowStock({ itemType: 'Extra', search: 'shot', threshold: 3 });
    await service.inventoryOutOfStock({ storeId: 'store-explicit', itemType: 'Product' });

    expect(getSpy).toHaveBeenNthCalledWith(
      1,
      '/v1/pos/reports/inventory/current?itemType=Product&search=latte&storeId=store-context',
    );
    expect(getSpy).toHaveBeenNthCalledWith(
      2,
      '/v1/pos/reports/inventory/low-stock?itemType=Extra&search=shot&threshold=3&storeId=store-context',
    );
    expect(getSpy).toHaveBeenNthCalledWith(
      3,
      '/v1/pos/reports/inventory/out-of-stock?storeId=store-explicit&itemType=Product',
    );
  });
});
