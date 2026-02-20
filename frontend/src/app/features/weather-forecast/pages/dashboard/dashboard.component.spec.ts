import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard.component';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { PosReportsApiService } from '../../../pos/services/pos-reports-api.service';
import { PosTimezoneService } from '../../../pos/services/pos-timezone.service';

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let apiMock: {
    getPaymentsByMethod: ReturnType<typeof vi.fn>;
    getTopProducts: ReturnType<typeof vi.fn>;
    getHourlySales: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    apiMock = {
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

  it('loads charts on init with current week range', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(apiMock.getPaymentsByMethod).toHaveBeenCalledWith({
      dateFrom: '2026-03-09',
      dateTo: '2026-03-11',
    });
    expect(apiMock.getTopProducts).toHaveBeenCalledWith({
      dateFrom: '2026-03-09',
      dateTo: '2026-03-11',
      top: 5,
    });
    expect(apiMock.getHourlySales).toHaveBeenCalledWith({
      dateFrom: '2026-03-09',
      dateTo: '2026-03-11',
    });
  });

  it('uses today range when period changes to today', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    apiMock.getPaymentsByMethod.mockClear();

    fixture.componentInstance.onPeriodChange('today');
    await fixture.whenStable();

    expect(apiMock.getPaymentsByMethod).toHaveBeenCalledWith({
      dateFrom: '2026-03-11',
      dateTo: '2026-03-11',
    });
  });

  it('uses month range when period changes to month', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    apiMock.getPaymentsByMethod.mockClear();

    fixture.componentInstance.onPeriodChange('month');
    await fixture.whenStable();

    expect(apiMock.getPaymentsByMethod).toHaveBeenCalledWith({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-31',
    });
  });

  it('shows custom date inputs only for custom period', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[data-testid="dashboard-date-from"]')).toBeNull();

    fixture.componentInstance.onPeriodChange('custom');
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="dashboard-date-from"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="dashboard-date-to"]')).not.toBeNull();
  });

  it('does not reload charts when custom range is invalid', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    apiMock.getPaymentsByMethod.mockClear();

    fixture.componentInstance.onPeriodChange('custom');
    fixture.componentInstance.onCustomDateFromChange('2026-03-12');
    fixture.componentInstance.onCustomDateToChange('2026-03-10');
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

  it('shows friendly errors per chart when requests fail', async () => {
    apiMock.getTopProducts.mockRejectedValueOnce(new Error('boom'));

    await fixture.componentInstance.loadTopProductsChart({
      dateFrom: '2026-03-09',
      dateTo: '2026-03-11',
    });

    expect(fixture.componentInstance.topProductsError()).toBe(
      'No disponible temporalmente. Intenta nuevamente.',
    );
    expect(fixture.componentInstance.topProductsData()).toEqual([]);
  });
});
