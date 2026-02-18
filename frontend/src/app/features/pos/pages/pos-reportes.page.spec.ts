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
    getKpisSummary: ReturnType<typeof vi.fn>;
    getSalesMixByCategories: ReturnType<typeof vi.fn>;
    getSalesMixByProducts: ReturnType<typeof vi.fn>;
    getAddonsExtrasUsage: ReturnType<typeof vi.fn>;
    getAddonsOptionsUsage: ReturnType<typeof vi.fn>;
    getCashDifferencesControl: ReturnType<typeof vi.fn>;
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
      getKpisSummary: vi.fn().mockResolvedValue({
        tickets: 12,
        totalItems: 30,
        grossSales: 1000,
        avgTicket: 83.3,
        avgItemsPerTicket: 2.5,
        voidCount: 1,
        voidRate: 0.08,
      }),
      getSalesMixByCategories: vi.fn().mockResolvedValue({
        items: [
          {
            categoryId: 'cat-1',
            categoryName: 'Bebidas',
            tickets: 5,
            quantity: 8,
            grossSales: 500,
          },
        ],
      }),
      getSalesMixByProducts: vi.fn().mockResolvedValue({
        items: [
          {
            productId: 'prod-1',
            sku: 'LATTE',
            productName: 'Latte',
            tickets: 4,
            quantity: 6,
            grossSales: 300,
          },
        ],
      }),
      getAddonsExtrasUsage: vi.fn().mockResolvedValue({
        items: [
          { extraId: 'extra-1', extraSku: 'EXT', extraName: 'Queso', quantity: 4, grossSales: 80 },
        ],
      }),
      getAddonsOptionsUsage: vi.fn().mockResolvedValue({
        items: [
          {
            optionItemId: 'opt-1',
            optionItemSku: 'OP1',
            optionItemName: 'Salsa',
            usageCount: 3,
            grossImpact: 20,
          },
        ],
      }),
      getCashDifferencesControl: vi.fn().mockResolvedValue({
        daily: [],
        shifts: [
          {
            shiftId: 'shift-1',
            openedAt: '2026-03-07T09:00:00Z',
            closedAt: '2026-03-07T16:00:00Z',
            cashierUserId: 'cashier-1',
            cashierUserName: 'Cajero Demo',
            expectedCash: 100,
            countedCash: 80,
            difference: -20,
            closeReason: 'Short',
          },
        ],
      }),
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
            formatDateTime: (value: string) => value,
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

  it('reloads reports using selected cashier and shift and calls v2 endpoints', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.selectedCashierUserId.set('cashier-1');
    fixture.componentInstance.selectedShiftId.set('shift-1');

    await fixture.componentInstance.loadReports();

    expect(apiMock.getKpisSummary).toHaveBeenLastCalledWith({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-07',
      cashierUserId: 'cashier-1',
      shiftId: 'shift-1',
    });
    expect(apiMock.getSalesMixByProducts).toHaveBeenLastCalledWith({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-07',
      cashierUserId: 'cashier-1',
      shiftId: 'shift-1',
      top: 20,
    });
    expect(apiMock.getCashDifferencesControl).toHaveBeenLastCalledWith({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-07',
      cashierUserId: 'cashier-1',
    });
  });

  it('shows block error when one section fails while keeping others rendered', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    apiMock.getSalesMixByCategories.mockRejectedValueOnce(new Error('boom'));
    await fixture.componentInstance.loadReports();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const error = compiled.querySelector('[data-testid="report-error-mixCategories"]');

    expect(error).not.toBeNull();
    expect(apiMock.getKpisSummary).toHaveBeenCalled();
  });

  it('hides shift column and prefers cashier user name in cash differences table', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const cashDiffHeaderCells = Array.from(
      compiled.querySelectorAll('[data-testid="cash-diff-table"] thead th'),
    ).map((cell) => cell.textContent?.trim());

    expect(cashDiffHeaderCells).not.toContain('Turno');
    expect(cashDiffHeaderCells[0]).toBe('Cajero');

    const firstRowCells = compiled.querySelectorAll('[data-testid="cash-diff-row-0"] td');
    expect(firstRowCells.item(0).textContent).toContain('Cajero Demo');
  });

});
