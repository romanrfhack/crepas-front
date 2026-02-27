import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  PlatformDashboardAlertDto,
  PlatformDashboardSummaryDto,
  PlatformOutOfStockRowDto,
  PlatformRecentInventoryAdjustmentDto,
  PlatformTopTenantRowDto,
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

@Component({
  selector: 'app-platform-dashboard-page',
  imports: [FormsModule],
  templateUrl: './platform-dashboard.page.html',
  styleUrl: './platform-dashboard.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlatformDashboardPage {
  private readonly api = inject(PlatformDashboardApiService);

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
}
