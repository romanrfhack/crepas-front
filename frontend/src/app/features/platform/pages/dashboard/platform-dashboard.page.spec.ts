import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { PlatformDashboardApiService } from '../../services/platform-dashboard-api.service';
import { PlatformDashboardPage } from './platform-dashboard.page';

describe('PlatformDashboardPage', () => {
  let fixture: ComponentFixture<PlatformDashboardPage>;
  const navigate = vi.fn().mockResolvedValue(true);

  const service = {
    getSummary: vi.fn(),
    getTopTenants: vi.fn(),
    getAlerts: vi.fn(),
    getAlertDrilldown: vi.fn(),
    getTenantOverview: vi.fn(),
    getStoreStockoutDetails: vi.fn(),
    getRecentInventoryAdjustments: vi.fn(),
    getOutOfStock: vi.fn(),
    getExecutiveSignals: vi.fn(),
    getSalesTrend: vi.fn(),
    getTopVoidTenants: vi.fn(),
    getStockoutHotspots: vi.fn(),
    getActivityFeed: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    service.getSummary.mockResolvedValue({
      activeTenants: 2,
      inactiveTenants: 1,
      activeStores: 3,
      inactiveStores: 1,
      totalUsers: 8,
      usersWithoutStoreAssignment: 0,
      tenantsWithoutCatalogTemplate: 0,
      storesWithoutAdminStore: 0,
      salesTodayCount: 2,
      salesTodayAmount: 100,
      salesLast7DaysCount: 7,
      salesLast7DaysAmount: 700,
      openShiftsCount: 1,
      outOfStockItemsCount: 4,
      lowStockItemsCount: 5,
      effectiveDateFromUtc: '2026-01-01',
      effectiveDateToUtc: '2026-01-02',
      effectiveLowStockThreshold: 5,
    });
    service.getTopTenants.mockResolvedValue({
      items: [
        {
          tenantId: 'tenant-1',
          tenantName: 'Tenant 1',
          verticalId: 'v1',
          verticalName: 'Retail',
          storeCount: 1,
          salesCount: 2,
          salesAmount: 120,
          averageTicket: 60,
          voidedSalesCount: 0,
        },
      ],
      effectiveDateFromUtc: 'a',
      effectiveDateToUtc: 'b',
      top: 10,
      includeInactive: false,
    });
    service.getAlerts.mockResolvedValue({
      alerts: [
        {
          code: 'TENANT_WITHOUT_TEMPLATE',
          severity: 'High',
          count: 1,
          description: 'desc',
          topExamples: [],
        },
      ],
    });
    service.getAlertDrilldown.mockResolvedValue({
      code: 'TENANT_WITHOUT_TEMPLATE',
      items: [
        {
          tenantId: 'tenant-1',
          tenantName: 'Tenant 1',
          storeId: null,
          storeName: null,
          userId: null,
          userName: null,
          email: null,
          role: null,
          description: 'Tenant sin template',
          reason: 'MissingTemplate',
          metadata: null,
        },
      ],
    });
    service.getTenantOverview.mockResolvedValue({
      tenantId: 'tenant-1',
      tenantName: 'Tenant 1',
      verticalId: 'v1',
      verticalName: 'Retail',
      storeCount: 2,
      activeStoreCount: 1,
      totalUsers: 8,
      usersWithoutStoreAssignmentCount: 1,
      salesInRangeCount: 9,
      salesInRangeAmount: 1000,
      voidedSalesCount: 1,
      outOfStockItemsCount: 4,
      lowStockItemsCount: 5,
      lastInventoryAdjustmentAtUtc: '2026-01-01T00:00:00Z',
      hasCatalogTemplate: true,
      storesWithoutAdminStoreCount: 1,
      effectiveDateFromUtc: 'a',
      effectiveDateToUtc: 'b',
      effectiveThreshold: 5,
    });
    service.getStoreStockoutDetails.mockResolvedValue({
      storeId: 'store-2',
      storeName: 'Store 2',
      tenantId: 'tenant-1',
      tenantName: 'Tenant 1',
      mode: 'out-of-stock',
      effectiveThreshold: 5,
      items: [
        {
          itemType: 'Product',
          itemId: 'item-1',
          itemName: 'Item 1',
          itemSku: 'SKU-1',
          stockOnHandQty: 0,
          isInventoryTracked: true,
          availabilityReason: 'OutOfStock',
          lastAdjustmentAtUtc: '2026-01-01T01:00:00Z',
        },
      ],
    });
    service.getRecentInventoryAdjustments.mockResolvedValue({
      items: [
        {
          adjustmentId: 'adj-1',
          tenantId: 'tenant-1',
          tenantName: 'Tenant 1',
          storeId: 'store-1',
          storeName: 'Store 1',
          itemType: 'Product',
          itemId: 'item-1',
          itemName: 'Item 1',
          itemSku: 'SKU',
          qtyBefore: 1,
          qtyDelta: -1,
          qtyAfter: 0,
          reason: 'Manual',
          referenceType: null,
          referenceId: null,
          movementKind: 'Out',
          createdAtUtc: '2026-01-01',
          performedByUserId: null,
        },
      ],
      take: 20,
    });
    service.getOutOfStock.mockResolvedValue({
      items: [
        {
          tenantId: 'tenant-1',
          tenantName: 'Tenant 1',
          storeId: 'store-1',
          storeName: 'Store 1',
          itemType: 'Product',
          itemId: 'item-1',
          itemName: 'Item 1',
          itemSku: 'SKU',
          stockOnHandQty: 0,
          updatedAtUtc: '2026-01-01',
          lastAdjustmentAtUtc: null,
        },
      ],
    });
    service.getExecutiveSignals.mockResolvedValue({
      fastestGrowingTenantId: 'tenant-1',
      fastestGrowingTenantName: 'Tenant 1',
      salesGrowthRatePercent: 11,
      voidRatePercent: 2,
      tenantsWithNoSalesInRangeCount: 1,
      storesWithNoAdminStoreCount: 2,
      tenantsWithNoCatalogTemplateCount: 3,
      storesWithOutOfStockCount: 4,
      inventoryAdjustmentCountInRange: 9,
      topRiskTenantId: 'tenant-2',
      topRiskTenantName: 'Tenant 2',
      effectiveDateFromUtc: 'a',
      effectiveDateToUtc: 'b',
      previousPeriodCompare: true,
    });
    service.getSalesTrend.mockResolvedValue({
      items: [
        {
          bucketStartUtc: '2026-01-01',
          bucketLabel: '2026-01-01',
          salesCount: 3,
          salesAmount: 300,
          voidedSalesCount: 1,
          averageTicket: 100,
        },
      ],
      effectiveDateFromUtc: 'a',
      effectiveDateToUtc: 'b',
      granularity: 'day',
    });
    service.getTopVoidTenants.mockResolvedValue({
      items: [
        {
          tenantId: 'tenant-v',
          tenantName: 'Tenant Void',
          verticalId: 'v1',
          verticalName: 'Retail',
          voidedSalesCount: 3,
          voidedSalesAmount: 200,
          totalSalesCount: 50,
          voidRate: 0.06,
          storeCount: 2,
        },
      ],
      effectiveDateFromUtc: 'a',
      effectiveDateToUtc: 'b',
      top: 10,
    });
    service.getStockoutHotspots.mockResolvedValue({
      items: [
        {
          tenantId: 'tenant-1',
          tenantName: 'Tenant 1',
          storeId: 'store-2',
          storeName: 'Store 2',
          outOfStockItemsCount: 5,
          lowStockItemsCount: 8,
          lastInventoryMovementAtUtc: '2026-01-01',
          trackedItemsCount: 20,
        },
      ],
      threshold: 5,
      top: 10,
      itemType: null,
    });
    service.getActivityFeed.mockResolvedValue({
      items: [
        {
          eventType: 'SaleVoided',
          occurredAtUtc: '2026-01-01',
          tenantId: 'tenant-1',
          tenantName: 'Tenant 1',
          storeId: 'store-1',
          storeName: 'Store 1',
          title: 'Sale voided',
          description: 'd',
          referenceId: 'ref-1',
          severity: 'medium',
          actorUserId: 'u-1',
        },
      ],
      take: 20,
      eventType: null,
    });

    await TestBed.configureTestingModule({
      imports: [PlatformDashboardPage],
      providers: [
        { provide: PlatformDashboardApiService, useValue: service },
        { provide: Router, useValue: { navigate } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlatformDashboardPage);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders v1 and v2 sections', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(
      host.querySelector('[data-testid="platform-kpi-active-tenants"]')?.textContent,
    ).toContain('2');
    expect(
      host.querySelector('[data-testid="platform-executive-signal-growth"]')?.textContent,
    ).toContain('11');
    expect(host.querySelector('[data-testid="platform-sales-trend-row-0"]')).toBeTruthy();
    expect(
      host.querySelector('[data-testid="platform-top-void-tenant-row-tenant-v"]'),
    ).toBeTruthy();
    expect(
      host.querySelector('[data-testid="platform-stockout-hotspot-row-store-2"]'),
    ).toBeTruthy();
    expect(host.querySelector('[data-testid="platform-activity-feed-row-0"]')).toBeTruthy();
  });

  it('clicking alert opens drilldown and renders items', async () => {
    const host = fixture.nativeElement as HTMLElement;
    host
      .querySelector('[data-testid="platform-alert-drilldown-open-TENANT_WITHOUT_TEMPLATE"]')
      ?.dispatchEvent(new Event('click'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(service.getAlertDrilldown).toHaveBeenLastCalledWith({ code: 'TENANT_WITHOUT_TEMPLATE' });
    expect(host.querySelector('[data-testid="platform-alert-drilldown"]')).toBeTruthy();
    expect(
      host.querySelector('[data-testid="platform-alert-drilldown-row-0"]')?.textContent,
    ).toContain('Tenant sin template');
  });

  it('clicking tenant opens tenant overview', async () => {
    const host = fixture.nativeElement as HTMLElement;
    host
      .querySelector('[data-testid="platform-tenant-overview-open-tenant-1"]')
      ?.dispatchEvent(new Event('click'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(service.getTenantOverview).toHaveBeenLastCalledWith('tenant-1');
    expect(host.querySelector('[data-testid="platform-tenant-overview"]')).toBeTruthy();
    expect(
      host.querySelector('[data-testid="platform-tenant-overview-metric-tenantName"]')?.textContent,
    ).toContain('Tenant 1');
  });

  it('clicking stockout hotspot opens stockout details and filter apply sends request', async () => {
    const host = fixture.nativeElement as HTMLElement;
    host
      .querySelector('[data-testid="platform-store-stockout-open-store-2"]')
      ?.dispatchEvent(new Event('click'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(service.getStoreStockoutDetails).toHaveBeenCalledWith(
      'store-2',
      expect.objectContaining({ mode: 'out-of-stock' }),
    );
    expect(host.querySelector('[data-testid="platform-store-stockout-details"]')).toBeTruthy();

    fixture.componentInstance.stockoutDetailsItemType.set('Product');
    fixture.componentInstance.stockoutDetailsSearch.set('SKU');
    fixture.componentInstance.stockoutDetailsThreshold.set(3);
    fixture.componentInstance.stockoutDetailsMode.set('all');
    await fixture.componentInstance.applyStockoutDetailFilters();

    expect(service.getStoreStockoutDetails).toHaveBeenLastCalledWith('store-2', {
      itemType: 'Product',
      search: 'SKU',
      threshold: 3,
      mode: 'all',
      take: 200,
    });
  });

  it('navigates from alert quick actions with expected query params', async () => {
    const host = fixture.nativeElement as HTMLElement;

    service.getAlertDrilldown.mockResolvedValueOnce({
      code: 'STORE_WITHOUT_ADMINSTORE',
      items: [
        {
          tenantId: 'tenant-1',
          tenantName: 'Tenant 1',
          storeId: 'store-7',
          storeName: 'Store 7',
          userId: null,
          userName: null,
          email: null,
          role: null,
          description: 'Store sin admin',
          reason: 'MissingAdminStore',
          metadata: null,
        },
      ],
    });

    await fixture.componentInstance.openAlertDrilldown('STORE_WITHOUT_ADMINSTORE');
    fixture.detectChanges();
    host
      .querySelector('[data-testid="platform-alert-drilldown-action-STORE_WITHOUT_ADMINSTORE-0"]')
      ?.dispatchEvent(new Event('click'));
    await fixture.whenStable();

    expect(navigate).toHaveBeenLastCalledWith(['/app/admin/users'], {
      queryParams: { tenantId: 'tenant-1', storeId: 'store-7' },
    });
    expect(fixture.componentInstance.activeDrilldownPanel()).toBe('none');

    service.getAlertDrilldown.mockResolvedValueOnce({
      code: 'STORE_SCOPED_USER_WITHOUT_STORE',
      items: [
        {
          tenantId: 'tenant-2',
          tenantName: 'Tenant 2',
          storeId: null,
          storeName: null,
          userId: null,
          userName: null,
          email: null,
          role: null,
          description: 'User scoped sin store',
          reason: 'StoreMissing',
          metadata: null,
        },
      ],
    });

    await fixture.componentInstance.openAlertDrilldown('STORE_SCOPED_USER_WITHOUT_STORE');
    fixture.detectChanges();
    host
      .querySelector(
        '[data-testid="platform-alert-drilldown-action-STORE_SCOPED_USER_WITHOUT_STORE-0"]',
      )
      ?.dispatchEvent(new Event('click'));
    await fixture.whenStable();

    expect(navigate).toHaveBeenLastCalledWith(['/app/admin/users'], {
      queryParams: { tenantId: 'tenant-2' },
    });

    service.getAlertDrilldown.mockResolvedValueOnce({
      code: 'TENANT_WITHOUT_TEMPLATE',
      items: [
        {
          tenantId: 'tenant-3',
          tenantName: 'Tenant 3',
          storeId: null,
          storeName: null,
          userId: null,
          userName: null,
          email: null,
          role: null,
          description: 'Tenant sin template',
          reason: 'MissingTemplate',
          metadata: null,
        },
      ],
    });

    await fixture.componentInstance.openAlertDrilldown('TENANT_WITHOUT_TEMPLATE');
    fixture.detectChanges();
    host
      .querySelector('[data-testid="platform-alert-drilldown-action-TENANT_WITHOUT_TEMPLATE-0"]')
      ?.dispatchEvent(new Event('click'));
    await fixture.whenStable();

    expect(navigate).toHaveBeenLastCalledWith(['/app/platform/tenants']);
  });

  it('navigates from tenant/store drilldowns to users with scoped query params', async () => {
    const host = fixture.nativeElement as HTMLElement;

    await fixture.componentInstance.openTenantOverview('tenant-1');
    fixture.detectChanges();

    host
      .querySelector('[data-testid="platform-tenant-overview-action-users"]')
      ?.dispatchEvent(new Event('click'));
    await fixture.whenStable();

    expect(navigate).toHaveBeenLastCalledWith(['/app/admin/users'], {
      queryParams: { tenantId: 'tenant-1' },
    });

    await fixture.componentInstance.openStoreStockoutDetails('store-2');
    fixture.detectChanges();

    host
      .querySelector('[data-testid="platform-store-stockout-action-users"]')
      ?.dispatchEvent(new Event('click'));
    await fixture.whenStable();

    expect(navigate).toHaveBeenLastCalledWith(['/app/admin/users'], {
      queryParams: { tenantId: 'tenant-1', storeId: 'store-2' },
    });
  });

  it('renders disabled alert action when required context is missing', async () => {
    service.getAlertDrilldown.mockResolvedValueOnce({
      code: 'STORE_WITHOUT_ADMINSTORE',
      items: [
        {
          tenantId: 'tenant-1',
          tenantName: 'Tenant 1',
          storeId: null,
          storeName: null,
          userId: null,
          userName: null,
          email: null,
          role: null,
          description: 'Missing store context',
          reason: 'MissingStoreId',
          metadata: null,
        },
      ],
    });

    await fixture.componentInstance.openAlertDrilldown('STORE_WITHOUT_ADMINSTORE');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const disabled = host.querySelector(
      '[data-testid="platform-alert-drilldown-action-disabled-STORE_WITHOUT_ADMINSTORE-0"]',
    ) as HTMLButtonElement;

    expect(disabled).toBeTruthy();
    expect(disabled.disabled).toBe(true);
  });

  it('shows stable invalid alert code error for 400 responses', async () => {
    service.getAlertDrilldown.mockRejectedValueOnce({ status: 400 });

    await fixture.componentInstance.openAlertDrilldown('INVALID_CODE');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(
      host.querySelector('[data-testid="platform-alert-drilldown-error"]')?.textContent,
    ).toContain('Código de alerta inválido o no soportado.');
  });

  it('shows drilldown empty and error states', async () => {
    service.getAlertDrilldown.mockResolvedValueOnce({
      code: 'STORE_WITHOUT_ADMINSTORE',
      items: [],
    });
    service.getTenantOverview.mockRejectedValueOnce(new Error('boom'));
    service.getStoreStockoutDetails.mockRejectedValueOnce(new Error('boom'));

    await fixture.componentInstance.openAlertDrilldown('STORE_WITHOUT_ADMINSTORE');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-testid="platform-alert-drilldown-empty"]')).toBeTruthy();

    await fixture.componentInstance.openTenantOverview('tenant-1');
    fixture.detectChanges();
    expect(host.querySelector('[data-testid="platform-tenant-overview-error"]')).toBeTruthy();

    await fixture.componentInstance.openStoreStockoutDetails('store-2');
    fixture.detectChanges();
    expect(host.querySelector('[data-testid="platform-store-stockout-error"]')).toBeTruthy();
  });
});
