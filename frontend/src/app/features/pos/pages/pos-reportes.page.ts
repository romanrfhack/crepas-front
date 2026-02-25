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
  AddonsExtraUsageItemDto,
  AddonsOptionUsageItemDto,
  CashDifferencesShiftItemDto,
  DailySalesReportItemDto,
  HourlySalesReportItemDto,
  InventoryReportRowDto,
  PaymentsByMethodSummaryDto,
  PosReportFilters,
  SalesMixByCategoryItemDto,
  SalesMixByProductItemDto,
  ShiftSummaryReportItemDto,
  TopProductReportItemDto,
  VoidReasonReportItemDto,
} from '../models/pos-reports.models';
import { PosReportsApiService } from '../services/pos-reports-api.service';
import { PosTimezoneService } from '../services/pos-timezone.service';
import { AuthService } from '../../auth/services/auth.service';
import { PlatformTenantContextService } from '../../platform/services/platform-tenant-context.service';

type ReportSectionKey =
  | 'cashiers'
  | 'shifts'
  | 'dailySales'
  | 'payments'
  | 'hourly'
  | 'topProducts'
  | 'voidReasons'
  | 'mixCategories'
  | 'mixProducts'
  | 'addonsExtras'
  | 'addonsOptions'
  | 'cashDifferences'
  | 'inventoryCurrent'
  | 'inventoryLow'
  | 'inventoryOut';

@Component({
  selector: 'app-pos-reportes-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './pos-reportes.page.html',
  styleUrl: './pos-reportes.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PosReportesPage implements OnInit {
  private readonly reportsApi = inject(PosReportsApiService);
  readonly timezoneService = inject(PosTimezoneService);
  private readonly authService = inject(AuthService);
  private readonly tenantContext = inject(PlatformTenantContextService);

  readonly today = this.timezoneService.todayIsoDate();
  readonly from = signal(this.getDateDaysAgo(6));
  readonly to = signal(this.today);
  readonly selectedCashierUserId = signal('');
  readonly selectedShiftId = signal('');
  readonly inventoryStoreId = signal('');
  readonly inventoryItemType = signal<'Product' | 'Extra' | ''>('');
  readonly inventorySearch = signal('');
  readonly inventoryThreshold = signal(5);

  readonly loading = signal(false);
  readonly sectionLoading = signal<Record<ReportSectionKey, boolean>>({
    cashiers: false,
    shifts: false,
    dailySales: false,
    payments: false,
    hourly: false,
    topProducts: false,
    voidReasons: false,
    mixCategories: false,
    mixProducts: false,
    addonsExtras: false,
    addonsOptions: false,
    cashDifferences: false,
    inventoryCurrent: false,
    inventoryLow: false,
    inventoryOut: false,
  });
  readonly sectionErrors = signal<Partial<Record<ReportSectionKey, string>>>({});

  readonly cashiers = signal<string[]>([]);
  readonly shifts = signal<ShiftSummaryReportItemDto[]>([]);
  readonly dailySales = signal<DailySalesReportItemDto[]>([]);
  readonly paymentSummary = signal<PaymentsByMethodSummaryDto | null>(null);
  readonly hourlySales = signal<HourlySalesReportItemDto[]>([]);
  readonly topProducts = signal<TopProductReportItemDto[]>([]);
  readonly voidReasons = signal<VoidReasonReportItemDto[]>([]);

  readonly mixCategories = signal<SalesMixByCategoryItemDto[]>([]);
  readonly mixProducts = signal<SalesMixByProductItemDto[]>([]);
  readonly addonsExtras = signal<AddonsExtraUsageItemDto[]>([]);
  readonly addonsOptions = signal<AddonsOptionUsageItemDto[]>([]);
  readonly cashDifferenceShifts = signal<CashDifferencesShiftItemDto[]>([]);
  readonly inventoryCurrentRows = signal<InventoryReportRowDto[]>([]);
  readonly inventoryLowRows = signal<InventoryReportRowDto[]>([]);
  readonly inventoryOutRows = signal<InventoryReportRowDto[]>([]);

  readonly tenantRequiredError = computed(() => {
    if (!this.authService.hasRole('SuperAdmin')) {
      return '';
    }

    return this.tenantContext.getSelectedTenantId()
      ? ''
      : 'Selecciona Tenant en Plataforma para consultar reportes POS.';
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

  readonly mixCategoriesRows = computed(() => {
    const rows = this.mixCategories();
    const grossTotal = rows.reduce((sum, row) => sum + row.grossSales, 0);
    return rows.map((row) => ({
      ...row,
      percent: grossTotal > 0 ? (row.grossSales / grossTotal) * 100 : 0,
    }));
  });

  readonly mixProductsRows = computed(() => {
    const rows = this.mixProducts();
    const grossTotal = rows.reduce((sum, row) => sum + row.grossSales, 0);
    return rows.map((row) => ({
      ...row,
      percent: grossTotal > 0 ? (row.grossSales / grossTotal) * 100 : 0,
    }));
  });

  ngOnInit(): void {
    void this.loadReports();
  }

  async loadReports() {
    this.loading.set(true);
    this.sectionErrors.set({});

    const baseFilters = this.buildBaseFilters();
    const detailFilters: PosReportFilters = {
      ...baseFilters,
      cashierUserId: this.selectedCashierUserId() || undefined,
      shiftId: this.selectedShiftId() || undefined,
    };

    const promises: Array<Promise<void>> = [
      this.loadSection('cashiers', async () => {
        const cashiers = await this.reportsApi.getCashiers(baseFilters);
        this.cashiers.set(cashiers.map((item) => item.cashierUserId));

        const selectedCashierUserId = this.selectedCashierUserId();
        if (
          selectedCashierUserId &&
          !cashiers.some((item) => item.cashierUserId === selectedCashierUserId)
        ) {
          this.selectedCashierUserId.set('');
        }
      }),
      this.loadSection('shifts', async () => {
        const shifts = await this.reportsApi.getShiftsSummary({
          ...baseFilters,
          cashierUserId: this.selectedCashierUserId() || undefined,
        });
        this.shifts.set(shifts);

        const selectedShiftId = this.selectedShiftId();
        if (selectedShiftId && !shifts.some((shift) => shift.shiftId === selectedShiftId)) {
          this.selectedShiftId.set('');
        }
      }),
      this.loadSection('dailySales', async () => {
        this.dailySales.set(await this.reportsApi.getDailySales(detailFilters));
      }),
      this.loadSection('payments', async () => {
        this.paymentSummary.set(await this.reportsApi.getPaymentsByMethod(detailFilters));
      }),
      this.loadSection('hourly', async () => {
        this.hourlySales.set(await this.reportsApi.getHourlySales(detailFilters));
      }),
      this.loadSection('topProducts', async () => {
        this.topProducts.set(await this.reportsApi.getTopProducts({ ...detailFilters, top: 10 }));
      }),
      this.loadSection('voidReasons', async () => {
        this.voidReasons.set(await this.reportsApi.getVoidReasons(detailFilters));
      }),
      this.loadSection('mixCategories', async () => {
        const response = await this.reportsApi.getSalesMixByCategories(detailFilters);
        this.mixCategories.set(response.items);
      }),
      this.loadSection('mixProducts', async () => {
        const response = await this.reportsApi.getSalesMixByProducts({ ...detailFilters, top: 20 });
        this.mixProducts.set(response.items);
      }),
      this.loadSection('addonsExtras', async () => {
        const response = await this.reportsApi.getAddonsExtrasUsage({ ...detailFilters, top: 20 });
        this.addonsExtras.set(response.items);
      }),
      this.loadSection('addonsOptions', async () => {
        const response = await this.reportsApi.getAddonsOptionsUsage({ ...detailFilters, top: 20 });
        this.addonsOptions.set(response.items);
      }),
      this.loadSection('cashDifferences', async () => {
        const response = await this.reportsApi.getCashDifferencesControl({
          ...baseFilters,
          cashierUserId: this.selectedCashierUserId() || undefined,
        });
        this.cashDifferenceShifts.set(response.shifts);
      }),
      this.loadSection('inventoryCurrent', async () => {
        this.inventoryCurrentRows.set(await this.reportsApi.inventoryCurrent(this.buildInventoryFilters()));
      }),
      this.loadSection('inventoryLow', async () => {
        this.inventoryLowRows.set(
          await this.reportsApi.inventoryLowStock({
            ...this.buildInventoryFilters(),
            threshold: this.inventoryThreshold(),
          }),
        );
      }),
      this.loadSection('inventoryOut', async () => {
        this.inventoryOutRows.set(await this.reportsApi.inventoryOutOfStock(this.buildInventoryFilters()));
      }),
    ];

    await Promise.allSettled(promises);
    this.loading.set(false);
  }

  getHourlyBarWidth(totalSales: number): string {
    const max = this.hourlyMax();
    if (max <= 0) {
      return '0%';
    }

    return `${Math.max((totalSales / max) * 100, 2)}%`;
  }

  getPercentBarWidth(percent: number): string {
    return `${Math.max(percent, 2)}%`;
  }

  shouldHighlightCashDifference(row: CashDifferencesShiftItemDto): boolean {
    return Math.abs(row.difference) > 0;
  }

  isSectionLoading(section: ReportSectionKey): boolean {
    return this.sectionLoading()[section];
  }

  getSectionError(section: ReportSectionKey): string {
    return this.sectionErrors()[section] ?? '';
  }

  private async loadSection(
    section: ReportSectionKey,
    request: () => Promise<void>,
  ): Promise<void> {
    this.updateSectionLoading(section, true);
    this.sectionErrors.update((state) => ({
      ...state,
      [section]: undefined,
    }));

    try {
      await request();
    } catch {
      this.sectionErrors.update((state) => ({
        ...state,
        [section]: 'No disponible temporalmente. Intenta nuevamente.',
      }));
    } finally {
      this.updateSectionLoading(section, false);
    }
  }

  private updateSectionLoading(section: ReportSectionKey, loading: boolean) {
    this.sectionLoading.update((state) => ({
      ...state,
      [section]: loading,
    }));
  }

  private buildBaseFilters(): Omit<PosReportFilters, 'cashierUserId' | 'shiftId'> {
    return {
      dateFrom: this.from(),
      dateTo: this.to(),
    };
  }

  private buildInventoryFilters() {
    return {
      storeId: this.inventoryStoreId() || undefined,
      itemType: this.inventoryItemType() || undefined,
      search: this.inventorySearch() || undefined,
    };
  }

  private getDateDaysAgo(daysAgo: number): string {
    const base = new Date();
    base.setUTCDate(base.getUTCDate() - daysAgo);
    return this.timezoneService.getIsoDateInBusinessTimezone(base);
  }
}
