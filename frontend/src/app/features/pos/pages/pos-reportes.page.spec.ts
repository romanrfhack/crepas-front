import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PosReportesPage } from './pos-reportes.page';
import { PosReportsApiService } from '../services/pos-reports-api.service';
import { PosTimezoneService } from '../services/pos-timezone.service';

describe('PosReportesPage', () => {
  let fixture: ComponentFixture<PosReportesPage>;
  let apiMock: {
    getCashiers: ReturnType<typeof vi.fn>;
    getShiftsSummary: ReturnType<typeof vi.fn>;
    getDailySales: ReturnType<typeof vi.fn>;
    getPaymentsByMethod: ReturnType<typeof vi.fn>;
    getHourlySales: ReturnType<typeof vi.fn>;
    getTopProducts: ReturnType<typeof vi.fn>;
    getVoidReasons: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    apiMock = {
      getCashiers: vi.fn().mockResolvedValue([{ cashierUserId: 'cashier-1' }]),
      getShiftsSummary: vi
        .fn()
        .mockResolvedValue([{ shiftId: 'shift-1', cashierUserId: 'cashier-1' }]),
      getDailySales: vi.fn().mockResolvedValue([
        {
          businessDate: '2026-03-07',
          tickets: 2,
          subtotal: 100,
          discounts: 0,
          tax: 0,
          totalSales: 100,
          avgTicket: 50,
          voidsCount: 0,
          voidsTotal: 0,
          payments: { cash: 50, card: 50, transfer: 0 },
        },
      ]),
      getPaymentsByMethod: vi.fn().mockResolvedValue({
        dateFrom: '2026-03-01',
        dateTo: '2026-03-07',
        totals: [{ method: 'Cash', count: 2, amount: 100 }],
      }),
      getHourlySales: vi.fn().mockResolvedValue([{ hour: 9, tickets: 2, totalSales: 100 }]),
      getTopProducts: vi
        .fn()
        .mockResolvedValue([
          { productId: 'p1', productNameSnapshot: 'Producto 1', qty: 2, amount: 100 },
        ]),
      getVoidReasons: vi
        .fn()
        .mockResolvedValue([
          { reasonCode: 'CashierError', reasonText: 'captura', count: 1, amount: 50 },
        ]),
    };

    await TestBed.configureTestingModule({
      imports: [PosReportesPage],
      providers: [
        { provide: PosReportsApiService, useValue: apiMock },
        {
          provide: PosTimezoneService,
          useValue: {
            todayIsoDate: () => '2026-03-07',
            getIsoDateInBusinessTimezone: () => '2026-03-01',
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PosReportesPage);
  });

  it('loads default last-7-day range on init and requests reports', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.from()).toBe('2026-03-01');
    expect(fixture.componentInstance.to()).toBe('2026-03-07');
    expect(apiMock.getDailySales).toHaveBeenCalledWith({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-07',
      cashierUserId: undefined,
      shiftId: undefined,
    });
  });

  it('reloads reports using selected cashier and shift', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.selectedCashierUserId.set('cashier-1');
    fixture.componentInstance.selectedShiftId.set('shift-1');

    await fixture.componentInstance.loadReports();

    expect(apiMock.getDailySales).toHaveBeenLastCalledWith({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-07',
      cashierUserId: 'cashier-1',
      shiftId: 'shift-1',
    });
    expect(apiMock.getTopProducts).toHaveBeenLastCalledWith({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-07',
      cashierUserId: 'cashier-1',
      shiftId: 'shift-1',
      top: 10,
    });
  });
});
