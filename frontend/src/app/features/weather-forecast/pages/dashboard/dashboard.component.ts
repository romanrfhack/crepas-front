import { CommonModule, DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Color, NgxChartsModule, ScaleType } from '@swimlane/ngx-charts';
import { PosReportFilters } from '../../../pos/models/pos-reports.models';
import { PosReportsApiService } from '../../../pos/services/pos-reports-api.service';
import { PosTimezoneService } from '../../../pos/services/pos-timezone.service';

interface ChartDataPoint {
  name: string;
  value: number;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, NgxChartsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly document = inject(DOCUMENT);
  private readonly reportsApi = inject(PosReportsApiService);
  private readonly timezoneService = inject(PosTimezoneService);

  readonly loadingPayments = signal(false);
  readonly loadingTopProducts = signal(false);
  readonly loadingHourlySales = signal(false);

  readonly paymentError = signal<string | null>(null);
  readonly topProductsError = signal<string | null>(null);
  readonly hourlySalesError = signal<string | null>(null);

  readonly paymentMethodData = signal<ChartDataPoint[]>([]);
  readonly topProductsData = signal<ChartDataPoint[]>([]);
  readonly hourlySalesData = signal<ChartDataPoint[]>([]);

  readonly hasPaymentData = computed(() => this.paymentMethodData().length > 0);
  readonly hasTopProductsData = computed(() => this.topProductsData().length > 0);
  readonly hasHourlySalesData = computed(() => this.hourlySalesData().length > 0);

  readonly chartColorScheme = signal<Color>({
    name: 'brand-dashboard',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: ['#e89aac', '#6b3f2a', '#f3b6c2', '#c98d6a', '#0f172a', '#475569'],
  });

  constructor() {
    afterNextRender(() => {
      this.chartColorScheme.set(this.buildColorSchemeFromCssVariables());
    });
  }

  ngOnInit(): void {
    void Promise.all([
      this.loadPaymentsByMethodChart(),
      this.loadTopProductsChart(),
      this.loadHourlySalesChart(),
    ]);
  }

  async loadPaymentsByMethodChart() {
    this.loadingPayments.set(true);
    this.paymentError.set(null);

    try {
      const response = await this.reportsApi.getPaymentsByMethod(this.buildLast7DaysFilters());
      this.paymentMethodData.set(this.toPaymentMethodChartData(response.totals));
    } catch {
      this.paymentError.set('No disponible temporalmente. Intenta nuevamente.');
      this.paymentMethodData.set([]);
    } finally {
      this.loadingPayments.set(false);
    }
  }

  async loadTopProductsChart() {
    this.loadingTopProducts.set(true);
    this.topProductsError.set(null);

    try {
      const response = await this.reportsApi.getTopProducts({
        ...this.buildLast7DaysFilters(),
        top: 5,
      });
      this.topProductsData.set(
        response.map((item) => ({ name: item.productNameSnapshot, value: item.amount })),
      );
    } catch {
      this.topProductsError.set('No disponible temporalmente. Intenta nuevamente.');
      this.topProductsData.set([]);
    } finally {
      this.loadingTopProducts.set(false);
    }
  }

  async loadHourlySalesChart() {
    this.loadingHourlySales.set(true);
    this.hourlySalesError.set(null);

    try {
      const response = await this.reportsApi.getHourlySales(this.buildLast7DaysFilters());
      this.hourlySalesData.set(
        response.map((item) => ({
          name: `${item.hour.toString().padStart(2, '0')}:00`,
          value: item.totalSales,
        })),
      );
    } catch {
      this.hourlySalesError.set('No disponible temporalmente. Intenta nuevamente.');
      this.hourlySalesData.set([]);
    } finally {
      this.loadingHourlySales.set(false);
    }
  }

  private toPaymentMethodChartData(items: Array<{ method: string; amount: number }>): ChartDataPoint[] {
    const sorted = [...items]
      .map((item) => ({ name: item.method, value: item.amount }))
      .sort((left, right) => right.value - left.value);

    if (sorted.length <= 5) {
      return sorted;
    }

    const primary = sorted.slice(0, 4);
    const othersTotal = sorted.slice(4).reduce((sum, item) => sum + item.value, 0);

    return othersTotal > 0 ? [...primary, { name: 'Otros', value: othersTotal }] : primary;
  }

  private buildLast7DaysFilters(): PosReportFilters {
    const today = this.timezoneService.todayIsoDate();
    const fromDate = new Date();
    fromDate.setUTCDate(fromDate.getUTCDate() - 6);

    return {
      dateFrom: this.timezoneService.getIsoDateInBusinessTimezone(fromDate),
      dateTo: today,
    };
  }

  private buildColorSchemeFromCssVariables(): Color {
    const computedStyle = getComputedStyle(this.document.documentElement);
    const resolveToken = (token: string, fallback: string) => {
      const value = computedStyle.getPropertyValue(token).trim();
      return value.length > 0 ? value : fallback;
    };

    return {
      name: 'brand-dashboard',
      selectable: true,
      group: ScaleType.Ordinal,
      domain: [
        resolveToken('--brand-rose-strong', '#e89aac'),
        resolveToken('--brand-cocoa', '#6b3f2a'),
        resolveToken('--brand-rose', '#f3b6c2'),
        '#c98d6a',
        resolveToken('--brand-ink', '#0f172a'),
        resolveToken('--brand-muted', '#475569'),
      ],
    };
  }
}
