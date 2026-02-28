import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  PlatformActivityFeedEventType,
  PlatformActivityFeedItemDto,
  PlatformActivityFeedQuery,
  PlatformDashboardAlertDrilldownItemDto,
  PlatformDashboardAlertDto,
  PlatformDashboardItemType,
  PlatformDashboardSummaryDto,
  PlatformExecutiveSignalsDto,
  PlatformOutOfStockRowDto,
  PlatformRecentInventoryAdjustmentDto,
  PlatformSalesTrendPointDto,
  PlatformSalesTrendQuery,
  PlatformStockoutDetailsMode,
  PlatformStockoutHotspotRowDto,
  PlatformStoreStockoutDetailDto,
  PlatformTenantOverviewDto,
  PlatformTopTenantRowDto,
  PlatformTopVoidTenantRowDto,
} from '../../models/platform.models';
import { PlatformDashboardApiService } from '../../services/platform-dashboard-api.service';

const DEFAULT_SUMMARY: PlatformDashboardSummaryDto = {
  activeTenants: 0,
  inactiveTenants: 0,
  activeStores: 0,
  inactiveStores: 0,
  totalUsers: 0,
  usersWithoutStoreAssignment: 0,
  tenantsWithoutCatalogTemplate: 0,
  storesWithoutAdminStore: 0,
  salesTodayCount: 0,
  salesTodayAmount: 0,
  salesLast7DaysCount: 0,
  salesLast7DaysAmount: 0,
  openShiftsCount: 0,
  outOfStockItemsCount: 0,
  lowStockItemsCount: 0,
  effectiveDateFromUtc: '',
  effectiveDateToUtc: '',
  effectiveLowStockThreshold: 0,
};

const DEFAULT_EXECUTIVE_SIGNALS: PlatformExecutiveSignalsDto = {
  fastestGrowingTenantId: null,
  fastestGrowingTenantName: null,
  salesGrowthRatePercent: 0,
  voidRatePercent: 0,
  tenantsWithNoSalesInRangeCount: 0,
  storesWithNoAdminStoreCount: 0,
  tenantsWithNoCatalogTemplateCount: 0,
  storesWithOutOfStockCount: 0,
  inventoryAdjustmentCountInRange: 0,
  topRiskTenantId: null,
  topRiskTenantName: null,
  effectiveDateFromUtc: '',
  effectiveDateToUtc: '',
  previousPeriodCompare: true,
};

type DashboardDrilldownPanel = 'none' | 'alert' | 'tenant' | 'stockout';

@Component({
  selector: 'app-platform-dashboard-page',
  imports: [FormsModule],
  templateUrl: './platform-dashboard.page.html',
  styleUrl: './platform-dashboard.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlatformDashboardPage {
  private readonly api = inject(PlatformDashboardApiService);
  private readonly router = inject(Router);

  readonly summary = signal<PlatformDashboardSummaryDto>(DEFAULT_SUMMARY);
  readonly summaryLoading = signal(false);
  readonly summaryError = signal<string | null>(null);

  readonly topTenants = signal<PlatformTopTenantRowDto[]>([]);
  readonly topTenantsLoading = signal(false);
  readonly topTenantsError = signal<string | null>(null);
  readonly topTenantsDateFrom = signal('');
  readonly topTenantsDateTo = signal('');
  readonly topTenantsTop = signal(10);

  readonly alerts = signal<PlatformDashboardAlertDto[]>([]);
  readonly alertsLoading = signal(false);
  readonly alertsError = signal<string | null>(null);

  readonly recentAdjustments = signal<PlatformRecentInventoryAdjustmentDto[]>([]);
  readonly recentAdjustmentsLoading = signal(false);
  readonly recentAdjustmentsError = signal<string | null>(null);
  readonly recentTake = signal(20);
  readonly recentReason = signal('');
  readonly recentTenantId = signal('');
  readonly recentStoreId = signal('');

  readonly outOfStock = signal<PlatformOutOfStockRowDto[]>([]);
  readonly outOfStockLoading = signal(false);
  readonly outOfStockError = signal<string | null>(null);
  readonly outTenantId = signal('');
  readonly outStoreId = signal('');
  readonly outItemType = signal('');
  readonly outSearch = signal('');
  readonly outTop = signal(50);

  readonly executiveSignals = signal<PlatformExecutiveSignalsDto>(DEFAULT_EXECUTIVE_SIGNALS);
  readonly executiveSignalsLoading = signal(false);
  readonly executiveSignalsError = signal<string | null>(null);

  readonly salesTrend = signal<PlatformSalesTrendPointDto[]>([]);
  readonly salesTrendLoading = signal(false);
  readonly salesTrendError = signal<string | null>(null);
  readonly salesTrendDateFrom = signal('');
  readonly salesTrendDateTo = signal('');
  readonly salesTrendGranularity = signal<'day' | 'week'>('day');

  readonly topVoidTenants = signal<PlatformTopVoidTenantRowDto[]>([]);
  readonly topVoidTenantsLoading = signal(false);
  readonly topVoidTenantsError = signal<string | null>(null);
  readonly topVoidDateFrom = signal('');
  readonly topVoidDateTo = signal('');
  readonly topVoidTop = signal(10);

  readonly stockoutHotspots = signal<PlatformStockoutHotspotRowDto[]>([]);
  readonly stockoutHotspotsLoading = signal(false);
  readonly stockoutHotspotsError = signal<string | null>(null);
  readonly stockoutThreshold = signal(5);
  readonly stockoutTop = signal(10);
  readonly stockoutItemType = signal<PlatformDashboardItemType | ''>('');

  readonly activityFeed = signal<PlatformActivityFeedItemDto[]>([]);
  readonly activityFeedLoading = signal(false);
  readonly activityFeedError = signal<string | null>(null);
  readonly activityFeedTake = signal(20);
  readonly activityFeedEventType = signal<PlatformActivityFeedEventType | ''>('');

  readonly activeDrilldownPanel = signal<DashboardDrilldownPanel>('none');

  readonly alertDrilldownCode = signal('');
  readonly alertDrilldownItems = signal<PlatformDashboardAlertDrilldownItemDto[]>([]);
  readonly alertDrilldownLoading = signal(false);
  readonly alertDrilldownError = signal<string | null>(null);

  readonly tenantOverview = signal<PlatformTenantOverviewDto | null>(null);
  readonly tenantOverviewLoading = signal(false);
  readonly tenantOverviewError = signal<string | null>(null);

  readonly selectedStockoutStoreId = signal('');
  readonly stockoutDetails = signal<PlatformStoreStockoutDetailDto | null>(null);
  readonly stockoutDetailsLoading = signal(false);
  readonly stockoutDetailsError = signal<string | null>(null);
  readonly stockoutDetailsItemType = signal<PlatformDashboardItemType | ''>('');
  readonly stockoutDetailsSearch = signal('');
  readonly stockoutDetailsThreshold = signal(5);
  readonly stockoutDetailsMode = signal<PlatformStockoutDetailsMode>('out-of-stock');
  readonly stockoutDetailsTake = signal(200);

  constructor() {
    void this.refreshAll();
  }

  async refreshAll() {
    await Promise.all([
      this.loadSummary(),
      this.loadTopTenants(),
      this.loadAlerts(),
      this.loadRecentAdjustments(),
      this.loadOutOfStock(),
      this.loadExecutiveSignals(),
      this.loadSalesTrend(),
      this.loadTopVoidTenants(),
      this.loadStockoutHotspots(),
      this.loadActivityFeed(),
    ]);
  }

  async loadSummary() {
    this.summaryLoading.set(true);
    this.summaryError.set(null);
    try {
      this.summary.set(await this.api.getSummary());
    } catch {
      this.summaryError.set('No se pudo cargar summary.');
    } finally {
      this.summaryLoading.set(false);
    }
  }

  async loadTopTenants() {
    this.topTenantsLoading.set(true);
    this.topTenantsError.set(null);
    try {
      const response = await this.api.getTopTenants({
        dateFrom: this.topTenantsDateFrom() || undefined,
        dateTo: this.topTenantsDateTo() || undefined,
        top: this.topTenantsTop(),
      });
      this.topTenants.set(response.items);
    } catch {
      this.topTenantsError.set('No se pudo cargar top tenants.');
    } finally {
      this.topTenantsLoading.set(false);
    }
  }

  async loadAlerts() {
    this.alertsLoading.set(true);
    this.alertsError.set(null);
    try {
      const response = await this.api.getAlerts();
      this.alerts.set(response.alerts);
    } catch {
      this.alertsError.set('No se pudieron cargar alertas.');
    } finally {
      this.alertsLoading.set(false);
    }
  }

  async loadRecentAdjustments() {
    this.recentAdjustmentsLoading.set(true);
    this.recentAdjustmentsError.set(null);
    try {
      const response = await this.api.getRecentInventoryAdjustments({
        take: this.recentTake(),
        reason: this.recentReason() || undefined,
        tenantId: this.recentTenantId() || undefined,
        storeId: this.recentStoreId() || undefined,
      });
      this.recentAdjustments.set(response.items);
    } catch {
      this.recentAdjustmentsError.set('No se pudieron cargar ajustes de inventario.');
    } finally {
      this.recentAdjustmentsLoading.set(false);
    }
  }

  async loadOutOfStock() {
    this.outOfStockLoading.set(true);
    this.outOfStockError.set(null);
    try {
      const response = await this.api.getOutOfStock({
        tenantId: this.outTenantId() || undefined,
        storeId: this.outStoreId() || undefined,
        itemType: this.outItemType() || undefined,
        search: this.outSearch() || undefined,
        top: this.outTop(),
      });
      this.outOfStock.set(response.items);
    } catch {
      this.outOfStockError.set('No se pudo cargar out-of-stock.');
    } finally {
      this.outOfStockLoading.set(false);
    }
  }

  async loadExecutiveSignals() {
    this.executiveSignalsLoading.set(true);
    this.executiveSignalsError.set(null);
    try {
      this.executiveSignals.set(await this.api.getExecutiveSignals());
    } catch {
      this.executiveSignalsError.set('No se pudieron cargar señales ejecutivas.');
    } finally {
      this.executiveSignalsLoading.set(false);
    }
  }

  async loadSalesTrend() {
    this.salesTrendLoading.set(true);
    this.salesTrendError.set(null);
    try {
      const query: PlatformSalesTrendQuery = {
        dateFrom: this.salesTrendDateFrom() || undefined,
        dateTo: this.salesTrendDateTo() || undefined,
        granularity: this.salesTrendGranularity(),
      };
      const response = await this.api.getSalesTrend(query);
      this.salesTrend.set(response.items);
    } catch {
      this.salesTrendError.set('No se pudo cargar sales trend.');
    } finally {
      this.salesTrendLoading.set(false);
    }
  }

  async loadTopVoidTenants() {
    this.topVoidTenantsLoading.set(true);
    this.topVoidTenantsError.set(null);
    try {
      const response = await this.api.getTopVoidTenants({
        dateFrom: this.topVoidDateFrom() || undefined,
        dateTo: this.topVoidDateTo() || undefined,
        top: this.topVoidTop(),
      });
      this.topVoidTenants.set(response.items);
    } catch {
      this.topVoidTenantsError.set('No se pudo cargar top void tenants.');
    } finally {
      this.topVoidTenantsLoading.set(false);
    }
  }

  async loadStockoutHotspots() {
    this.stockoutHotspotsLoading.set(true);
    this.stockoutHotspotsError.set(null);
    try {
      const response = await this.api.getStockoutHotspots({
        threshold: this.stockoutThreshold(),
        top: this.stockoutTop(),
        itemType: this.stockoutItemType() || undefined,
      });
      this.stockoutHotspots.set(response.items);
    } catch {
      this.stockoutHotspotsError.set('No se pudo cargar stockout hotspots.');
    } finally {
      this.stockoutHotspotsLoading.set(false);
    }
  }

  async loadActivityFeed() {
    this.activityFeedLoading.set(true);
    this.activityFeedError.set(null);
    try {
      const query: PlatformActivityFeedQuery = {
        take: this.activityFeedTake(),
        eventType: this.activityFeedEventType() || undefined,
      };
      const response = await this.api.getActivityFeed(query);
      this.activityFeed.set(response.items);
    } catch {
      this.activityFeedError.set('No se pudo cargar activity feed.');
    } finally {
      this.activityFeedLoading.set(false);
    }
  }

  async openAlertDrilldown(code: string) {
    this.activeDrilldownPanel.set('alert');
    this.alertDrilldownCode.set(code);
    this.alertDrilldownItems.set([]);
    this.alertDrilldownError.set(null);
    this.alertDrilldownLoading.set(true);

    try {
      const response = await this.api.getAlertDrilldown({ code });
      this.alertDrilldownItems.set(response.items);
    } catch (error: unknown) {
      this.alertDrilldownError.set(
        this.getErrorStatus(error) === 400
          ? 'Código de alerta inválido o no soportado.'
          : 'No se pudo cargar el drill-down de la alerta.',
      );
    } finally {
      this.alertDrilldownLoading.set(false);
    }
  }

  async openTenantOverview(tenantId: string) {
    this.activeDrilldownPanel.set('tenant');
    this.tenantOverviewError.set(null);
    this.tenantOverview.set(null);
    this.tenantOverviewLoading.set(true);

    try {
      const response = await this.api.getTenantOverview(tenantId);
      this.tenantOverview.set(response);
    } catch {
      this.tenantOverviewError.set('No se pudo cargar el overview del tenant.');
    } finally {
      this.tenantOverviewLoading.set(false);
    }
  }

  async openStoreStockoutDetails(storeId: string) {
    this.activeDrilldownPanel.set('stockout');
    this.selectedStockoutStoreId.set(storeId);
    this.stockoutDetailsError.set(null);
    this.stockoutDetails.set(null);
    await this.loadStoreStockoutDetails();
  }

  async loadStoreStockoutDetails() {
    if (!this.selectedStockoutStoreId()) {
      return;
    }

    this.stockoutDetailsLoading.set(true);
    this.stockoutDetailsError.set(null);

    try {
      const response = await this.api.getStoreStockoutDetails(this.selectedStockoutStoreId(), {
        itemType: this.stockoutDetailsItemType() || undefined,
        search: this.stockoutDetailsSearch() || undefined,
        threshold: this.stockoutDetailsThreshold(),
        mode: this.stockoutDetailsMode(),
        take: this.stockoutDetailsTake(),
      });
      this.stockoutDetails.set(response);
    } catch {
      this.stockoutDetailsError.set('No se pudo cargar el detalle de stockout.');
    } finally {
      this.stockoutDetailsLoading.set(false);
    }
  }

  async applyStockoutDetailFilters() {
    await this.loadStoreStockoutDetails();
  }

  alertActionDisabled(code: string, item: PlatformDashboardAlertDrilldownItemDto) {
    if (code === 'STORE_WITHOUT_ADMINSTORE') {
      return !item.tenantId || !item.storeId;
    }

    if (code === 'STORE_SCOPED_USER_WITHOUT_STORE') {
      return !item.tenantId;
    }

    return false;
  }

  alertActionLabel(code: string) {
    if (code === 'STORE_WITHOUT_ADMINSTORE') {
      return 'Crear AdminStore';
    }

    if (code === 'TENANT_WITHOUT_TEMPLATE') {
      return 'Ir a tenants';
    }

    return 'Ver usuarios de la sucursal';
  }

  hasAlertAction(code: string) {
    return [
      'STORE_WITHOUT_ADMINSTORE',
      'STORE_SCOPED_USER_WITHOUT_STORE',
      'TENANT_WITHOUT_TEMPLATE',
    ].includes(code);
  }

  async navigateFromAlert(code: string, item: PlatformDashboardAlertDrilldownItemDto) {
    if (this.alertActionDisabled(code, item)) {
      return;
    }

    if (code === 'STORE_WITHOUT_ADMINSTORE') {
      await this.navigateToUsers(item.tenantId, item.storeId, {
        openCreate: true,
        suggestedRole: 'AdminStore',
      });
      return;
    }

    if (code === 'STORE_SCOPED_USER_WITHOUT_STORE') {
      await this.navigateToUsers(item.tenantId, null);
      return;
    }

    if (code === 'TENANT_WITHOUT_TEMPLATE') {
      await this.router.navigate(['/app/platform/tenants']);
      this.closeDrilldown();
    }
  }

  async navigateToTenantUsers() {
    const tenantId = this.tenantOverview()?.tenantId;
    await this.navigateToUsers(tenantId ?? null, null, {
      openCreate: true,
      suggestedRole: 'TenantAdmin',
    });
  }

  async navigateToStoreUsers() {
    const details = this.stockoutDetails();
    await this.navigateToUsers(details?.tenantId ?? null, details?.storeId ?? null, {
      openCreate: true,
      suggestedRole: 'Cashier',
    });
  }

  closeDrilldown() {
    this.activeDrilldownPanel.set('none');
    this.alertDrilldownCode.set('');
    this.alertDrilldownItems.set([]);
    this.alertDrilldownError.set(null);
    this.tenantOverview.set(null);
    this.tenantOverviewError.set(null);
    this.selectedStockoutStoreId.set('');
    this.stockoutDetails.set(null);
    this.stockoutDetailsError.set(null);
  }

  severityClass(severity: string) {
    const normalized = severity.toLowerCase();
    if (normalized === 'high') {
      return 'severity-high';
    }

    if (normalized === 'medium') {
      return 'severity-medium';
    }

    return 'severity-low';
  }

  money(value: number) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
  }

  private getErrorStatus(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null || !('status' in error)) {
      return undefined;
    }

    const status = error.status;
    return typeof status === 'number' ? status : undefined;
  }

  private async navigateToUsers(
    tenantId: string | null,
    storeId: string | null,
    options: { openCreate?: boolean; suggestedRole?: string } = {},
  ) {
    const queryParams: {
      tenantId?: string;
      storeId?: string;
      intent?: string;
      suggestedRole?: string;
    } = {};
    if (tenantId) {
      queryParams.tenantId = tenantId;
    }
    if (storeId) {
      queryParams.storeId = storeId;
    }
    if (options.openCreate) {
      queryParams.intent = 'create-user';
    }
    if (options.suggestedRole) {
      queryParams.suggestedRole = options.suggestedRole;
    }

    await this.router.navigate(['/app/admin/users'], {
      queryParams,
    });
    this.closeDrilldown();
  }
}
