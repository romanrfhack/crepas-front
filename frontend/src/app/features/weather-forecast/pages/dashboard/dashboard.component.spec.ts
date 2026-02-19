import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard.component';
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
        dateFrom: '2026-03-01',
        dateTo: '2026-03-07',
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

    fixture = TestBed.createComponent(DashboardComponent);
  });

  it('loads payment/top/hourly charts on init with the last-7-day range', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(apiMock.getPaymentsByMethod).toHaveBeenCalledWith({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-07',
    });
    expect(apiMock.getTopProducts).toHaveBeenCalledWith({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-07',
      top: 5,
    });
    expect(apiMock.getHourlySales).toHaveBeenCalledWith({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-07',
    });

    expect(fixture.componentInstance.paymentMethodData()).toEqual([
      { name: 'Cash', value: 1200 },
      { name: 'Card', value: 800 },
    ]);
    expect(fixture.componentInstance.hourlySalesData()).toEqual([
      { name: '08:00', value: 250 },
      { name: '10:00', value: 410 },
    ]);
  });

  it('groups minor payment methods into "Otros" when there are more than 5 methods', async () => {
    apiMock.getPaymentsByMethod.mockResolvedValueOnce({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-07',
      totals: [
        { method: 'Cash', count: 5, amount: 500 },
        { method: 'Card', count: 4, amount: 400 },
        { method: 'Transfer', count: 3, amount: 300 },
        { method: 'Wallet', count: 2, amount: 200 },
        { method: 'Voucher', count: 1, amount: 100 },
        { method: 'Crypto', count: 1, amount: 50 },
      ],
    });

    await fixture.componentInstance.loadPaymentsByMethodChart();

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

    await fixture.componentInstance.loadTopProductsChart();

    expect(fixture.componentInstance.topProductsError()).toBe(
      'No disponible temporalmente. Intenta nuevamente.',
    );
    expect(fixture.componentInstance.topProductsData()).toEqual([]);
  });
});
