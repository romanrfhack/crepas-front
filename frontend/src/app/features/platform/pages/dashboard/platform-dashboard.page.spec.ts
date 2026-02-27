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

    await TestBed.configureTestingModule({
      imports: [PlatformDashboardPage],
      providers: [{ provide: PlatformDashboardApiService, useValue: service }],
    }).compileComponents();

    fixture = TestBed.createComponent(PlatformDashboardPage);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders KPI cards and sections', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-testid="platform-kpi-active-tenants"]')?.textContent).toContain('2');
    expect(host.querySelector('[data-testid="platform-top-tenants-row-tenant-1"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="platform-alert-row-TENANT_WITHOUT_TEMPLATE"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="platform-recent-adjustment-row-adj-1"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="platform-out-of-stock-row-Product-item-1-store-1"]')).toBeTruthy();
  });

  it('refresh triggers all blocks', async () => {
    const host = fixture.nativeElement as HTMLElement;
    const beforeSummary = service.getSummary.mock.calls.length;
    const beforeTopTenants = service.getTopTenants.mock.calls.length;
    const beforeAlerts = service.getAlerts.mock.calls.length;
    const beforeAdjustments = service.getRecentInventoryAdjustments.mock.calls.length;
    const beforeOutOfStock = service.getOutOfStock.mock.calls.length;

    host.querySelector('[data-testid="platform-dashboard-refresh"]')?.dispatchEvent(new Event('click'));
    await fixture.whenStable();

    expect(service.getSummary.mock.calls.length).toBeGreaterThan(beforeSummary);
    expect(service.getTopTenants.mock.calls.length).toBeGreaterThan(beforeTopTenants);
    expect(service.getAlerts.mock.calls.length).toBeGreaterThan(beforeAlerts);
    expect(service.getRecentInventoryAdjustments.mock.calls.length).toBeGreaterThan(beforeAdjustments);
    expect(service.getOutOfStock.mock.calls.length).toBeGreaterThan(beforeOutOfStock);
  });

  it('top tenants and out-of-stock filters call service with expected query', async () => {
    const page = fixture.componentInstance;
    page.topTenantsDateFrom.set('2026-01-01');
    page.topTenantsDateTo.set('2026-01-31');
    page.topTenantsTop.set(12);
    await page.loadTopTenants();

    page.outTenantId.set('tenant-x');
    page.outStoreId.set('store-x');
    page.outItemType.set('Product');
    page.outSearch.set('latte');
    page.outTop.set(25);
    await page.loadOutOfStock();

    expect(service.getTopTenants).toHaveBeenLastCalledWith({
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      top: 12,
    });
    expect(service.getOutOfStock).toHaveBeenLastCalledWith({
      tenantId: 'tenant-x',
      storeId: 'store-x',
      itemType: 'Product',
      search: 'latte',
      top: 25,
    });
  });

  it('shows block error state', async () => {
    service.getAlerts.mockRejectedValueOnce(new Error('boom'));
    const page = fixture.componentInstance;
    await page.loadAlerts();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-testid="platform-alerts-error"]')).toBeTruthy();
  });
});
