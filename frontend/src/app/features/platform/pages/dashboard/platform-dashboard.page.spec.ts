import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlatformDashboardApiService } from '../../services/platform-dashboard-api.service';
import { PlatformDashboardPage } from './platform-dashboard.page';

describe('PlatformDashboardPage', () => {
  let fixture: ComponentFixture<PlatformDashboardPage>;
  const service = {
    getSummary: vi.fn(),
    getTopTenants: vi.fn(),
    getAlerts: vi.fn(),
    getRecentInventoryAdjustments: vi.fn(),
    getOutOfStock: vi.fn(),
    getExecutiveSignals: vi.fn(),
    getSalesTrend: vi.fn(),
    getTopVoidTenants: vi.fn(),
    getStockoutHotspots: vi.fn(),
    getActivityFeed: vi.fn(),
  };

  beforeEach(async () => {
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
    service.getTopTenants.mockResolvedValue({ items: [{ tenantId: 'tenant-1', tenantName: 'Tenant 1', verticalId: 'v1', verticalName: 'Retail', storeCount: 1, salesCount: 2, salesAmount: 120, averageTicket: 60, voidedSalesCount: 0 }], effectiveDateFromUtc: 'a', effectiveDateToUtc: 'b', top: 10, includeInactive: false });
    service.getAlerts.mockResolvedValue({ alerts: [{ code: 'TENANT_WITHOUT_TEMPLATE', severity: 'High', count: 1, description: 'desc', topExamples: [] }] });
    service.getRecentInventoryAdjustments.mockResolvedValue({ items: [{ adjustmentId: 'adj-1', tenantId: 'tenant-1', tenantName: 'Tenant 1', storeId: 'store-1', storeName: 'Store 1', itemType: 'Product', itemId: 'item-1', itemName: 'Item 1', itemSku: 'SKU', qtyBefore: 1, qtyDelta: -1, qtyAfter: 0, reason: 'Manual', referenceType: null, referenceId: null, movementKind: 'Out', createdAtUtc: '2026-01-01', performedByUserId: null }], take: 20 });
    service.getOutOfStock.mockResolvedValue({ items: [{ tenantId: 'tenant-1', tenantName: 'Tenant 1', storeId: 'store-1', storeName: 'Store 1', itemType: 'Product', itemId: 'item-1', itemName: 'Item 1', itemSku: 'SKU', stockOnHandQty: 0, updatedAtUtc: '2026-01-01', lastAdjustmentAtUtc: null }] });
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
    service.getSalesTrend.mockResolvedValue({ items: [{ bucketStartUtc: '2026-01-01', bucketLabel: '2026-01-01', salesCount: 3, salesAmount: 300, voidedSalesCount: 1, averageTicket: 100 }], effectiveDateFromUtc: 'a', effectiveDateToUtc: 'b', granularity: 'day' });
    service.getTopVoidTenants.mockResolvedValue({ items: [{ tenantId: 'tenant-v', tenantName: 'Tenant Void', verticalId: 'v1', verticalName: 'Retail', voidedSalesCount: 3, voidedSalesAmount: 200, totalSalesCount: 50, voidRate: 0.06, storeCount: 2 }], effectiveDateFromUtc: 'a', effectiveDateToUtc: 'b', top: 10 });
    service.getStockoutHotspots.mockResolvedValue({ items: [{ tenantId: 'tenant-1', tenantName: 'Tenant 1', storeId: 'store-2', storeName: 'Store 2', outOfStockItemsCount: 5, lowStockItemsCount: 8, lastInventoryMovementAtUtc: '2026-01-01', trackedItemsCount: 20 }], threshold: 5, top: 10, itemType: null });
    service.getActivityFeed.mockResolvedValue({ items: [{ eventType: 'SaleVoided', occurredAtUtc: '2026-01-01', tenantId: 'tenant-1', tenantName: 'Tenant 1', storeId: 'store-1', storeName: 'Store 1', title: 'Sale voided', description: 'd', referenceId: 'ref-1', severity: 'medium', actorUserId: 'u-1' }], take: 20, eventType: null });

    await TestBed.configureTestingModule({
      imports: [PlatformDashboardPage],
      providers: [{ provide: PlatformDashboardApiService, useValue: service }],
    }).compileComponents();

    fixture = TestBed.createComponent(PlatformDashboardPage);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders v1 and v2 sections', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-testid="platform-kpi-active-tenants"]')?.textContent).toContain('2');
    expect(host.querySelector('[data-testid="platform-executive-signal-growth"]')?.textContent).toContain('11');
    expect(host.querySelector('[data-testid="platform-sales-trend-row-0"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="platform-top-void-tenant-row-tenant-v"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="platform-stockout-hotspot-row-store-2"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="platform-activity-feed-row-0"]')).toBeTruthy();
  });

  it('refresh triggers all v1 + v2 blocks', async () => {
    const host = fixture.nativeElement as HTMLElement;
    const baseline = {
      summary: service.getSummary.mock.calls.length,
      topTenants: service.getTopTenants.mock.calls.length,
      alerts: service.getAlerts.mock.calls.length,
      adjustments: service.getRecentInventoryAdjustments.mock.calls.length,
      outOfStock: service.getOutOfStock.mock.calls.length,
      executiveSignals: service.getExecutiveSignals.mock.calls.length,
      salesTrend: service.getSalesTrend.mock.calls.length,
      topVoidTenants: service.getTopVoidTenants.mock.calls.length,
      hotspots: service.getStockoutHotspots.mock.calls.length,
      feed: service.getActivityFeed.mock.calls.length,
    };

    host.querySelector('[data-testid="platform-dashboard-refresh"]')?.dispatchEvent(new Event('click'));
    await fixture.whenStable();

    expect(service.getSummary.mock.calls.length).toBeGreaterThan(baseline.summary);
    expect(service.getTopTenants.mock.calls.length).toBeGreaterThan(baseline.topTenants);
    expect(service.getAlerts.mock.calls.length).toBeGreaterThan(baseline.alerts);
    expect(service.getRecentInventoryAdjustments.mock.calls.length).toBeGreaterThan(baseline.adjustments);
    expect(service.getOutOfStock.mock.calls.length).toBeGreaterThan(baseline.outOfStock);
    expect(service.getExecutiveSignals.mock.calls.length).toBeGreaterThan(baseline.executiveSignals);
    expect(service.getSalesTrend.mock.calls.length).toBeGreaterThan(baseline.salesTrend);
    expect(service.getTopVoidTenants.mock.calls.length).toBeGreaterThan(baseline.topVoidTenants);
    expect(service.getStockoutHotspots.mock.calls.length).toBeGreaterThan(baseline.hotspots);
    expect(service.getActivityFeed.mock.calls.length).toBeGreaterThan(baseline.feed);
  });

  it('sends expected filter queries for v2 blocks', async () => {
    const page = fixture.componentInstance;
    page.salesTrendDateFrom.set('2026-01-01');
    page.salesTrendDateTo.set('2026-01-31');
    page.salesTrendGranularity.set('week');
    await page.loadSalesTrend();

    page.topVoidDateFrom.set('2026-01-01');
    page.topVoidDateTo.set('2026-01-31');
    page.topVoidTop.set(7);
    await page.loadTopVoidTenants();

    page.stockoutThreshold.set(4);
    page.stockoutTop.set(6);
    page.stockoutItemType.set('Product');
    await page.loadStockoutHotspots();

    page.activityFeedTake.set(12);
    page.activityFeedEventType.set('InventoryAdjusted');
    await page.loadActivityFeed();

    expect(service.getSalesTrend).toHaveBeenLastCalledWith({
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      granularity: 'week',
    });
    expect(service.getTopVoidTenants).toHaveBeenLastCalledWith({
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      top: 7,
    });
    expect(service.getStockoutHotspots).toHaveBeenLastCalledWith({
      threshold: 4,
      top: 6,
      itemType: 'Product',
    });
    expect(service.getActivityFeed).toHaveBeenLastCalledWith({
      take: 12,
      eventType: 'InventoryAdjusted',
    });
  });

  it('shows v2 block errors independently', async () => {
    service.getSalesTrend.mockRejectedValueOnce(new Error('boom'));
    service.getExecutiveSignals.mockRejectedValueOnce(new Error('boom'));

    const page = fixture.componentInstance;
    await page.loadSalesTrend();
    await page.loadExecutiveSignals();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-testid="platform-sales-trend-error"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="platform-executive-signals-error"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="platform-top-void-tenant-row-tenant-v"]')).toBeTruthy();
  });
});
