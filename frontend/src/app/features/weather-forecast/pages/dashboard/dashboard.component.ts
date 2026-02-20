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
import { Color, NgxChartsModule, ScaleType } from '@swimlane/ngx-charts'; // aún se usa para el scheme de colores, pero podemos quitarlo si no es necesario
import {
  CashierSalesReportItemDto,
  KpisSummaryDto,
  PosReportFilters,
} from '../../../pos/models/pos-reports.models';
import { PosReportsApiService } from '../../../pos/services/pos-reports-api.service';
import { PosTimezoneService } from '../../../pos/services/pos-timezone.service';
import { NgApexchartsModule } from 'ng-apexcharts';
import {
  ApexChart,
  ApexNonAxisChartSeries,
  ApexAxisChartSeries,
  ApexXAxis,
  ApexYAxis,
  ApexPlotOptions,
  ApexDataLabels,
  ApexGrid,
  ApexLegend,
  ApexResponsive,
} from 'ng-apexcharts';

export type ChartOptions = {
  series: ApexNonAxisChartSeries | ApexAxisChartSeries;
  chart: ApexChart;
  xaxis?: ApexXAxis;
  yaxis?: ApexYAxis | ApexYAxis[];
  plotOptions?: ApexPlotOptions;
  dataLabels?: ApexDataLabels;
  grid?: ApexGrid;
  legend?: ApexLegend;
  colors?: string[];
  labels?: string[];
  responsive?: ApexResponsive[];
};

interface ChartDataPoint {
  name: string;
  value: number;
}

interface DashboardCashierOption {
  cashierUserId: string;
  userName: string;
}

type DashboardPeriod = 'today' | 'week' | 'month' | 'custom';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, NgApexchartsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly document = inject(DOCUMENT);
  private readonly reportsApi = inject(PosReportsApiService);
  private readonly timezoneService = inject(PosTimezoneService);

  // Estados de carga
  readonly loadingPayments = signal(false);
  readonly loadingTopProducts = signal(false);
  readonly loadingHourlySales = signal(false);
  readonly loadingCashiers = signal(false);
  readonly loadingKpis = signal(false);

  // Filtros
  readonly selectedPeriod = signal<DashboardPeriod>('week');
  readonly selectedCashierId = signal('');
  readonly customDateFrom = signal('');
  readonly customDateTo = signal('');

  // Errores
  readonly paymentError = signal<string | null>(null);
  readonly topProductsError = signal<string | null>(null);
  readonly hourlySalesError = signal<string | null>(null);
  readonly cashierError = signal<string | null>(null);
  readonly kpisError = signal<string | null>(null);

  // Datos
  readonly paymentMethodData = signal<ChartDataPoint[]>([]);
  readonly topProductsData = signal<ChartDataPoint[]>([]);
  readonly hourlySalesData = signal<ChartDataPoint[]>([]);
  readonly cashiers = signal<DashboardCashierOption[]>([]);
  readonly kpis = signal<KpisSummaryDto | null>(null);

  // Flags para mostrar datos
  readonly hasPaymentData = computed(() => this.paymentMethodData().length > 0);
  readonly hasTopProductsData = computed(() => this.topProductsData().length > 0);
  readonly hasHourlySalesData = computed(() => this.hourlySalesData().length > 0);
  readonly isCustomPeriod = computed(() => this.selectedPeriod() === 'custom');

  // Validación de fechas custom
  readonly customDateError = computed(() => {
    if (!this.isCustomPeriod()) return null;
    const from = this.customDateFrom();
    const to = this.customDateTo();
    if (!from || !to) return 'Selecciona un rango de fechas válido.';
    if (from > to) return 'La fecha "Desde" no puede ser mayor que "Hasta".';
    return null;
  });

  // Rango efectivo de fechas (según período seleccionado)
  readonly effectiveDateRange = computed<PosReportFilters | null>(() => {
    const period = this.selectedPeriod();
    const today = this.timezoneService.todayIsoDate();

    if (period === 'today') return { dateFrom: today, dateTo: today };
    if (period === 'week') return { dateFrom: this.getWeekStart(today), dateTo: today };
    if (period === 'month')
      return { dateFrom: this.getMonthStart(today), dateTo: this.getMonthEnd(today) };
    if (this.customDateError()) return null;
    return { dateFrom: this.customDateFrom(), dateTo: this.customDateTo() };
  });

  // Esquema de colores (desde variables CSS)
  readonly chartColorScheme = signal<string[]>([]);

  constructor() {
    // Inicializar fechas custom con últimos 7 días (por si se selecciona custom)
    const initialRange = this.buildLast7DaysFilters();
    this.customDateFrom.set(initialRange.dateFrom);
    this.customDateTo.set(initialRange.dateTo);

    // Efecto que recarga datos cuando cambian los filtros
    effect(() => {
      const dateRange = this.effectiveDateRange();
      const cashierId = this.selectedCashierId();
      if (!dateRange) return;
      void this.loadDashboardData({
        ...dateRange,
        cashierUserId: cashierId || undefined,
      });
    });

    afterNextRender(() => {
      this.loadColorScheme();
      void this.loadCashiers();
    });
  }

  // Métodos de cambio de filtros (desde template)
  onPeriodSelectChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as DashboardPeriod;
    this.selectedPeriod.set(value);
  }

  onCashierSelectChange(event: Event): void {
    this.selectedCashierId.set((event.target as HTMLSelectElement).value);
  }

  onCustomDateFromInput(event: Event): void {
    this.customDateFrom.set((event.target as HTMLInputElement).value);
  }

  onCustomDateToInput(event: Event): void {
    this.customDateTo.set((event.target as HTMLInputElement).value);
  }

  // Carga de todos los datos
  async loadDashboardData(filters: PosReportFilters): Promise<void> {
    await Promise.all([
      this.loadPaymentsByMethodChart(filters),
      this.loadTopProductsChart(filters),
      this.loadHourlySalesChart(filters),
      this.loadKpis(filters),
    ]);
  }

  // Carga de lista de cajeros
  async loadCashiers(): Promise<void> {
    this.loadingCashiers.set(true);
    this.cashierError.set(null);
    try {
      const today = this.timezoneService.todayIsoDate();
      const response = await this.reportsApi.getCashiers({
        dateFrom: this.getMonthStart(today),
        dateTo: this.getMonthEnd(today),
      });
      this.cashiers.set(this.toCashierOptions(response));
    } catch {
      this.cashierError.set('No disponible temporalmente. Intenta nuevamente.');
      this.cashiers.set([]);
    } finally {
      this.loadingCashiers.set(false);
    }
  }

  // KPIs
  async loadKpis(filters: PosReportFilters): Promise<void> {
    this.loadingKpis.set(true);
    this.kpisError.set(null);
    try {
      this.kpis.set(await this.reportsApi.getKpisSummary(filters));
    } catch {
      this.kpisError.set('No disponible temporalmente. Intenta nuevamente.');
      this.kpis.set(null);
    } finally {
      this.loadingKpis.set(false);
    }
  }

  // Métodos de pago (gráfico de dona)
  async loadPaymentsByMethodChart(filters: PosReportFilters): Promise<void> {
    this.loadingPayments.set(true);
    this.paymentError.set(null);
    try {
      const response = await this.reportsApi.getPaymentsByMethod(filters);
      this.paymentMethodData.set(this.toPaymentMethodChartData(response.totals));
    } catch {
      this.paymentError.set('No disponible temporalmente. Intenta nuevamente.');
      this.paymentMethodData.set([]);
    } finally {
      this.loadingPayments.set(false);
    }
  }

  // Top productos (barras horizontales)
  async loadTopProductsChart(filters: PosReportFilters): Promise<void> {
    this.loadingTopProducts.set(true);
    this.topProductsError.set(null);
    try {
      const response = await this.reportsApi.getTopProducts({ ...filters, top: 5 });
      this.topProductsData.set(
        response.map((item) => ({ name: item.productNameSnapshot, value: item.amount }))
      );
    } catch {
      this.topProductsError.set('No disponible temporalmente. Intenta nuevamente.');
      this.topProductsData.set([]);
    } finally {
      this.loadingTopProducts.set(false);
    }
  }

  // Ventas por hora (barras verticales)
  async loadHourlySalesChart(filters: PosReportFilters): Promise<void> {
    this.loadingHourlySales.set(true);
    this.hourlySalesError.set(null);
    try {
      const response = await this.reportsApi.getHourlySales(filters);
      this.hourlySalesData.set(
        response.map((item) => ({
          name: `${item.hour.toString().padStart(2, '0')}:00`,
          value: item.totalSales,
        }))
      );
    } catch {
      this.hourlySalesError.set('No disponible temporalmente. Intenta nuevamente.');
      this.hourlySalesData.set([]);
    } finally {
      this.loadingHourlySales.set(false);
    }
  }

  // Opciones de gráficas para ApexCharts
  readonly paymentMethodChartOptions = computed<ChartOptions>(() => ({
    series: this.paymentMethodData().map((d) => d.value),
    chart: { type: 'donut', height: 280 },
    labels: this.paymentMethodData().map((d) => d.name),
    colors: this.chartColorScheme(),
    legend: { position: 'bottom' },
    plotOptions: { pie: { donut: { size: '65%' } } },
    dataLabels: { enabled: true, formatter: (val: number) => val.toFixed(1) + '%' },
    responsive: [{ breakpoint: 480, options: { chart: { height: 200 } } }],
  }));

  readonly topProductsChartOptions = computed<ChartOptions>(() => ({
    series: [{ name: 'Monto', data: this.topProductsData().map((d) => d.value) }],
    chart: { type: 'bar', height: 280 },
    xaxis: { categories: this.topProductsData().map((d) => d.name) },
    yaxis: { title: { text: 'Monto ($)' } },
    plotOptions: { bar: { horizontal: true, barHeight: '50%' } },
    dataLabels: { enabled: true, formatter: (val: number) => `$${val.toFixed(0)}` },
    colors: this.chartColorScheme(),
    grid: { show: true },
  }));

  readonly hourlySalesChartOptions = computed<ChartOptions>(() => ({
    series: [{ name: 'Ventas', data: this.hourlySalesData().map((d) => d.value) }],
    chart: { type: 'bar', height: 280 },
    xaxis: { categories: this.hourlySalesData().map((d) => d.name) },
    yaxis: { title: { text: 'Ventas ($)' } },
    plotOptions: { bar: { horizontal: false, columnWidth: '60%' } },
    dataLabels: { enabled: true, formatter: (val: number) => `$${val.toFixed(0)}` },
    colors: this.chartColorScheme(),
    grid: { show: true },
  }));

  // Utilidades
  private toPaymentMethodChartData(
    items: Array<{ method: string; amount: number }>
  ): ChartDataPoint[] {
    const sorted = [...items]
      .map((item) => ({ name: item.method, value: item.amount }))
      .sort((a, b) => b.value - a.value);

    if (sorted.length <= 5) return sorted;
    const primary = sorted.slice(0, 4);
    const othersTotal = sorted.slice(4).reduce((sum, item) => sum + item.value, 0);
    return othersTotal > 0 ? [...primary, { name: 'Otros', value: othersTotal }] : primary;
  }

  private toCashierOptions(items: CashierSalesReportItemDto[]): DashboardCashierOption[] {
    const map = new Map<string, DashboardCashierOption>();
    for (const item of items) {
      if (!map.has(item.cashierUserId)) {
        const name = item.cashierUserName?.trim();
        map.set(item.cashierUserId, {
          cashierUserId: item.cashierUserId,
          userName: name && name.length > 0 ? name : item.cashierUserId,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.userName.localeCompare(b.userName, 'es'));
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
    const day = date.getUTCDay(); // 0 = domingo
    const daysFromMonday = day === 0 ? 6 : day - 1;
    date.setUTCDate(date.getUTCDate() - daysFromMonday);
    return this.toIsoDate(date);
  }

  private getMonthStart(isoDate: string): string {
    const [year, month] = isoDate.split('-');
    return `${year}-${month}-01`;
  }

  private getMonthEnd(isoDate: string): string {
    const [year, month] = isoDate.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${year.toString().padStart(4, '0')}-${month
      .toString()
      .padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
  }

  private parseIsoDateAsUtc(isoDate: string): Date {
    const [year, month, day] = isoDate.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  private toIsoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private loadColorScheme(): void {
    const style = getComputedStyle(this.document.documentElement);
    const colors = [
      style.getPropertyValue('--brand-rose-strong').trim() || '#e89aac',
      style.getPropertyValue('--brand-cocoa').trim() || '#6b3f2a',
      style.getPropertyValue('--brand-rose').trim() || '#f3b6c2',
      '#c98d6a',
      style.getPropertyValue('--brand-ink').trim() || '#0f172a',
      style.getPropertyValue('--brand-muted').trim() || '#475569',
    ];
    this.chartColorScheme.set(colors);
  }
}