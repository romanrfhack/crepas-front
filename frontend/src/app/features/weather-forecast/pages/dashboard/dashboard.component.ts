import { CommonModule, DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  effect,
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

type DashboardPeriod = 'today' | 'week' | 'month' | 'custom';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, NgxChartsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly document = inject(DOCUMENT);
  private readonly reportsApi = inject(PosReportsApiService);
  private readonly timezoneService = inject(PosTimezoneService);

  readonly loadingPayments = signal(false);
  readonly loadingTopProducts = signal(false);
  readonly loadingHourlySales = signal(false);

  readonly selectedPeriod = signal<DashboardPeriod>('week');
  readonly customDateFrom = signal('');
  readonly customDateTo = signal('');

  readonly paymentError = signal<string | null>(null);
  readonly topProductsError = signal<string | null>(null);
  readonly hourlySalesError = signal<string | null>(null);

  readonly paymentMethodData = signal<ChartDataPoint[]>([]);
  readonly topProductsData = signal<ChartDataPoint[]>([]);
  readonly hourlySalesData = signal<ChartDataPoint[]>([]);

  readonly hasPaymentData = computed(() => this.paymentMethodData().length > 0);
  readonly hasTopProductsData = computed(() => this.topProductsData().length > 0);
  readonly hasHourlySalesData = computed(() => this.hourlySalesData().length > 0);
  readonly isCustomPeriod = computed(() => this.selectedPeriod() === 'custom');

  readonly customDateError = computed(() => {
    if (!this.isCustomPeriod()) {
      return null;
    }

    const dateFrom = this.customDateFrom();
    const dateTo = this.customDateTo();

    if (!dateFrom || !dateTo) {
      return 'Selecciona un rango de fechas válido.';
    }

    if (dateFrom > dateTo) {
      return 'La fecha "Desde" no puede ser mayor que "Hasta".';
    }

    return null;
  });

  readonly effectiveDateRange = computed<PosReportFilters | null>(() => {
    const selectedPeriod = this.selectedPeriod();
    const today = this.timezoneService.todayIsoDate();

    if (selectedPeriod === 'today') {
      return { dateFrom: today, dateTo: today };
    }

    if (selectedPeriod === 'week') {
      return { dateFrom: this.getWeekStart(today), dateTo: today };
    }

    if (selectedPeriod === 'month') {
      return { dateFrom: this.getMonthStart(today), dateTo: this.getMonthEnd(today) };
    }

    if (this.customDateError()) {
      return null;
    }

    return {
      dateFrom: this.customDateFrom(),
      dateTo: this.customDateTo(),
    };
  });

  readonly chartColorScheme = signal<Color>({
    name: 'brand-dashboard',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: ['#e89aac', '#6b3f2a', '#f3b6c2', '#c98d6a', '#0f172a', '#475569'],
  });

  constructor() {
    const initialRange = this.buildLast7DaysFilters();
    this.customDateFrom.set(initialRange.dateFrom);
    this.customDateTo.set(initialRange.dateTo);

    effect(() => {
      const dateRange = this.effectiveDateRange();
      if (!dateRange) {
        return;
      }

      void this.loadAllCharts(dateRange);
    });

    afterNextRender(() => {
      this.chartColorScheme.set(this.buildColorSchemeFromCssVariables());
    });
  }

  onPeriodChange(period: DashboardPeriod): void {
    this.selectedPeriod.set(period);
  }

  onPeriodSelectChange(event: Event): void {
    const value = (event.target as HTMLSelectElement | null)?.value;
    if (value === 'today' || value === 'week' || value === 'month' || value === 'custom') {
      this.onPeriodChange(value);
    }
  }

  onCustomDateFromChange(value: string): void {
    this.customDateFrom.set(value);
  }

  onCustomDateFromInput(event: Event): void {
    this.onCustomDateFromChange((event.target as HTMLInputElement | null)?.value ?? '');
  }

  onCustomDateToChange(value: string): void {
    this.customDateTo.set(value);
  }

  onCustomDateToInput(event: Event): void {
    this.onCustomDateToChange((event.target as HTMLInputElement | null)?.value ?? '');
  }

  async loadAllCharts(filters: PosReportFilters): Promise<void> {
    await Promise.all([
      this.loadPaymentsByMethodChart(filters),
      this.loadTopProductsChart(filters),
      this.loadHourlySalesChart(filters),
    ]);
  }

  async loadPaymentsByMethodChart(filters?: PosReportFilters): Promise<void> {
    const resolvedFilters = filters ?? this.effectiveDateRange();
    if (!resolvedFilters) {
      return;
    }

    this.loadingPayments.set(true);
    this.paymentError.set(null);

    try {
      const response = await this.reportsApi.getPaymentsByMethod(resolvedFilters);
      this.paymentMethodData.set(this.toPaymentMethodChartData(response.totals));
    } catch {
      this.paymentError.set('No disponible temporalmente. Intenta nuevamente.');
      this.paymentMethodData.set([]);
    } finally {
      this.loadingPayments.set(false);
    }
  }

  async loadTopProductsChart(filters?: PosReportFilters): Promise<void> {
    const resolvedFilters = filters ?? this.effectiveDateRange();
    if (!resolvedFilters) {
      return;
    }

    this.loadingTopProducts.set(true);
    this.topProductsError.set(null);

    try {
      const response = await this.reportsApi.getTopProducts({
        ...resolvedFilters,
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

  async loadHourlySalesChart(filters?: PosReportFilters): Promise<void> {
    const resolvedFilters = filters ?? this.effectiveDateRange();
    if (!resolvedFilters) {
      return;
    }

    this.loadingHourlySales.set(true);
    this.hourlySalesError.set(null);

    try {
      const response = await this.reportsApi.getHourlySales(resolvedFilters);
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

  private toPaymentMethodChartData(
    items: Array<{ method: string; amount: number }>,
  ): ChartDataPoint[] {
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

  private getWeekStart(isoDate: string): string {
    const date = this.parseIsoDateAsUtc(isoDate);
    const day = date.getUTCDay();
    const daysFromMonday = day === 0 ? 6 : day - 1;
    date.setUTCDate(date.getUTCDate() - daysFromMonday);
    return this.toIsoDate(date);
  }

  private getMonthStart(isoDate: string): string {
    const [year, month] = isoDate.split('-');
    return `${year}-${month}-01`;
  }

  private getMonthEnd(isoDate: string): string {
    const [yearValue, monthValue] = isoDate.split('-').map((part) => Number(part));
    const lastDay = new Date(Date.UTC(yearValue, monthValue, 0)).getUTCDate();
    return `${yearValue.toString().padStart(4, '0')}-${monthValue
      .toString()
      .padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
  }

  private parseIsoDateAsUtc(isoDate: string): Date {
    const [year, month, day] = isoDate.split('-').map((part) => Number(part));
    return new Date(Date.UTC(year, month - 1, day));
  }

  private toIsoDate(value: Date): string {
    return value.toISOString().slice(0, 10);
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
