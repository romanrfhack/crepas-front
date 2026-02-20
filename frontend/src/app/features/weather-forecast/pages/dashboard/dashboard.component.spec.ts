import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard.component';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { PosReportsApiService } from '../../../pos/services/pos-reports-api.service';
import { PosTimezoneService } from '../../../pos/services/pos-timezone.service';

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let apiMock: {
    getCashiers: ReturnType<typeof vi.fn>;
    getKpisSummary: ReturnType<typeof vi.fn>;
    getPaymentsByMethod: ReturnType<typeof vi.fn>;
    getTopProducts: ReturnType<typeof vi.fn>;
    getHourlySales: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    apiMock = {
      getCashiers: vi
        .fn()
        .mockResolvedValue([
          { cashierUserId: 'cashier-1', cashierUserName: 'Ana' },
          { cashierUserId: 'cashier-2' },
        ]),
      getKpisSummary: vi.fn().mockResolvedValue({
        tickets: 18,
        totalItems: 48,
        grossSales: 2500,
        avgTicket: 138.88,
        avgItemsPerTicket: 2.66,
        voidCount: 1,
        voidRate: 0.02,
      }),
      getPaymentsByMethod: vi.fn().mockResolvedValue({
        dateFrom: '2026-03-09',
        dateTo: '2026-03-11',
        totals: [
          { method: 'Cash', count: 12, amount: 1200 },
          { method: 'Card', count: 8, amount: 800 },
        ],
      }),
      getTopProducts: vi.fn().mockResolvedValue([
        { productId: 'p1', productNameSnapshot: 'Latte', qty: 10, amount: 500 },
        { productId: 'p2', productNameSnapshot: 'Capuccino', qty: 6, amount: 320 },
      ]),
      getHourlySales: vi.fn().mockResolvedValue([
        { hour: 8, tickets: 4, totalSales: 250 },
        { hour: 10, tickets: 6, totalSales: 410 },
      ]),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideNoopAnimations(),
        { provide: PosReportsApiService, useValue: apiMock },
        {
          provide: PosTimezoneService,
          useValue: {
            todayIsoDate: () => '2026-03-11',
            getIsoDateInBusinessTimezone: () => '2026-03-05',
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
  });

  it('loads charts and KPIs on init with current week range', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(apiMock.getPaymentsByMethod).toHaveBeenCalledWith({
      dateFrom: '2026-03-09',
      dateTo: '2026-03-11',
      cashierUserId: undefined,
    });
    expect(apiMock.getTopProducts).toHaveBeenCalledWith({
      dateFrom: '2026-03-09',
      dateTo: '2026-03-11',
      cashierUserId: undefined,
      top: 5,
    });
    expect(apiMock.getHourlySales).toHaveBeenCalledWith({
      dateFrom: '2026-03-09',
      dateTo: '2026-03-11',
      cashierUserId: undefined,
    });
    expect(apiMock.getKpisSummary).toHaveBeenCalledWith({
      dateFrom: '2026-03-09',
      dateTo: '2026-03-11',
      cashierUserId: undefined,
    });
  });

  it('loads cashier options and renders userName or fallback id', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(apiMock.getCashiers).toHaveBeenCalledWith({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-31',
    });

    const options = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        '[data-testid="dashboard-cashier-select"] option',
      ),
    ).map((option) => option.textContent?.trim());

    expect(options).toContain('Ana');
    expect(options).toContain('cashier-2');
  });

  it('sends selected cashier in charts and kpi requests', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    apiMock.getPaymentsByMethod.mockClear();
    apiMock.getTopProducts.mockClear();
    apiMock.getHourlySales.mockClear();
    apiMock.getKpisSummary.mockClear();

    fixture.componentInstance.selectedCashierId.set('cashier-1');
    await fixture.whenStable();

    expect(apiMock.getPaymentsByMethod).toHaveBeenCalledWith({
      dateFrom: '2026-03-09',
      dateTo: '2026-03-11',
      cashierUserId: 'cashier-1',
    });
    expect(apiMock.getKpisSummary).toHaveBeenCalledWith({
      dateFrom: '2026-03-09',
      dateTo: '2026-03-11',
      cashierUserId: 'cashier-1',
    });
  });

  it('shows KPI values from API response', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(
      compiled.querySelector('[data-testid="dashboard-kpi-gross-sales"]')?.textContent,
    ).toContain('$2,500.00');
    expect(compiled.querySelector('[data-testid="dashboard-kpi-tickets"]')?.textContent).toContain(
      '18',
    );
  });

  it('uses today range when period changes to today', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    apiMock.getPaymentsByMethod.mockClear();

    fixture.componentInstance.onPeriodSelectChange({
      target: { value: 'today' },
    } as unknown as Event);
    await fixture.whenStable();

    expect(apiMock.getPaymentsByMethod).toHaveBeenCalledWith({
      dateFrom: '2026-03-11',
      dateTo: '2026-03-11',
      cashierUserId: undefined,
    });
  });

  it('does not reload charts when custom range is invalid', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    apiMock.getPaymentsByMethod.mockClear();

    fixture.componentInstance.onPeriodSelectChange({
      target: { value: 'custom' },
    } as unknown as Event);
    fixture.componentInstance.onCustomDateFromInput({
      target: { value: '2026-03-12' },
    } as unknown as Event);
    fixture.componentInstance.onCustomDateToInput({
      target: { value: '2026-03-10' },
    } as unknown as Event);
    await fixture.whenStable();

    expect(fixture.componentInstance.customDateError()).toBe(
      'La fecha "Desde" no puede ser mayor que "Hasta".',
    );
    expect(apiMock.getPaymentsByMethod).not.toHaveBeenCalled();
  });

  it('groups minor payment methods into "Otros" when there are more than 5 methods', async () => {
    apiMock.getPaymentsByMethod.mockResolvedValueOnce({
      dateFrom: '2026-03-09',
      dateTo: '2026-03-11',
      totals: [
        { method: 'Cash', count: 5, amount: 500 },
        { method: 'Card', count: 4, amount: 400 },
        { method: 'Transfer', count: 3, amount: 300 },
        { method: 'Wallet', count: 2, amount: 200 },
        { method: 'Voucher', count: 1, amount: 100 },
        { method: 'Crypto', count: 1, amount: 50 },
      ],
    });

    await fixture.componentInstance.loadPaymentsByMethodChart({
      dateFrom: '2026-03-09',
      dateTo: '2026-03-11',
    });

    expect(fixture.componentInstance.paymentMethodData()).toEqual([
      { name: 'Cash', value: 500 },
      { name: 'Card', value: 400 },
      { name: 'Transfer', value: 300 },
      { name: 'Wallet', value: 200 },
      { name: 'Otros', value: 150 },
    ]);
  });
});
