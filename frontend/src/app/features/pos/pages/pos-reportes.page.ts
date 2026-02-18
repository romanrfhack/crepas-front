import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DailySalesReportItemDto,
  HourlySalesReportItemDto,
  PaymentsByMethodSummaryDto,
  PosReportFilters,
  ShiftSummaryReportItemDto,
  TopProductReportItemDto,
  VoidReasonReportItemDto,
} from '../models/pos-reports.models';
import { PosReportsApiService } from '../services/pos-reports-api.service';
import { PosTimezoneService } from '../services/pos-timezone.service';

@Component({
  selector: 'app-pos-reportes-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './pos-reportes.page.html',
  styleUrl: './pos-reportes.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PosReportesPage implements OnInit {
  private readonly reportsApi = inject(PosReportsApiService);
  private readonly timezoneService = inject(PosTimezoneService);

  readonly today = this.timezoneService.todayIsoDate();
  readonly from = signal(this.getDateDaysAgo(6));
  readonly to = signal(this.today);
  readonly selectedCashierUserId = signal('');
  readonly selectedShiftId = signal('');

  readonly loading = signal(false);
  readonly errorMessage = signal('');

  readonly cashiers = signal<string[]>([]);
  readonly shifts = signal<ShiftSummaryReportItemDto[]>([]);
  readonly dailySales = signal<DailySalesReportItemDto[]>([]);
  readonly paymentSummary = signal<PaymentsByMethodSummaryDto | null>(null);
  readonly hourlySales = signal<HourlySalesReportItemDto[]>([]);
  readonly topProducts = signal<TopProductReportItemDto[]>([]);
  readonly voidReasons = signal<VoidReasonReportItemDto[]>([]);

  readonly summary = computed(() => {
    const totals = this.dailySales().reduce(
      (accumulator, current) => {
        accumulator.totalSales += current.totalSales;
        accumulator.tickets += current.tickets;
        return accumulator;
      },
      { totalSales: 0, tickets: 0 },
    );

    const avgTicket = totals.tickets > 0 ? totals.totalSales / totals.tickets : 0;
    return {
      totalSales: totals.totalSales,
      tickets: totals.tickets,
      avgTicket,
    };
  });

  readonly paymentRows = computed(() => {
    const rows = this.paymentSummary()?.totals ?? [];
    const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);

    return rows.map((row) => ({
      ...row,
      percentage: totalAmount > 0 ? (row.amount / totalAmount) * 100 : 0,
    }));
  });

  readonly hourlyMax = computed(() =>
    this.hourlySales().reduce((max, item) => Math.max(max, item.totalSales), 0),
  );

  ngOnInit(): void {
    void this.loadReports();
  }

  async loadReports() {
    this.loading.set(true);
    this.errorMessage.set('');

    try {
      const baseFilters = this.buildBaseFilters();
      const detailFilters: PosReportFilters = {
        ...baseFilters,
        cashierUserId: this.selectedCashierUserId() || undefined,
        shiftId: this.selectedShiftId() || undefined,
      };

      const [cashiers, shifts, dailySales, paymentSummary, hourlySales, topProducts, voidReasons] =
        await Promise.all([
          this.reportsApi.getCashiers(baseFilters),
          this.reportsApi.getShiftsSummary({
            ...baseFilters,
            cashierUserId: this.selectedCashierUserId() || undefined,
          }),
          this.reportsApi.getDailySales(detailFilters),
          this.reportsApi.getPaymentsByMethod(detailFilters),
          this.reportsApi.getHourlySales(detailFilters),
          this.reportsApi.getTopProducts({ ...detailFilters, top: 10 }),
          this.reportsApi.getVoidReasons(detailFilters),
        ]);

      this.cashiers.set(cashiers.map((item) => item.cashierUserId));
      this.shifts.set(shifts);
      this.dailySales.set(dailySales);
      this.paymentSummary.set(paymentSummary);
      this.hourlySales.set(hourlySales);
      this.topProducts.set(topProducts);
      this.voidReasons.set(voidReasons);

      const selectedShiftId = this.selectedShiftId();
      if (selectedShiftId && !shifts.some((shift) => shift.shiftId === selectedShiftId)) {
        this.selectedShiftId.set('');
      }

      const selectedCashierUserId = this.selectedCashierUserId();
      if (
        selectedCashierUserId &&
        !cashiers.some((item) => item.cashierUserId === selectedCashierUserId)
      ) {
        this.selectedCashierUserId.set('');
      }
    } catch {
      this.errorMessage.set('No pudimos cargar los reportes operativos. Intenta nuevamente.');
    } finally {
      this.loading.set(false);
    }
  }

  getHourlyBarWidth(totalSales: number): string {
    const max = this.hourlyMax();
    if (max <= 0) {
      return '0%';
    }

    return `${Math.max((totalSales / max) * 100, 2)}%`;
  }

  private buildBaseFilters(): Omit<PosReportFilters, 'cashierUserId' | 'shiftId'> {
    return {
      dateFrom: this.from(),
      dateTo: this.to(),
    };
  }

  private getDateDaysAgo(daysAgo: number): string {
    const base = new Date();
    base.setUTCDate(base.getUTCDate() - daysAgo);
    return this.timezoneService.getIsoDateInBusinessTimezone(base);
  }
}
