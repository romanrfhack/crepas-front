import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../../../core/services/api-client';
import { PlatformDashboardApiService } from './platform-dashboard-api.service';

describe('PlatformDashboardApiService', () => {
  it('builds dashboard query params including v3 drilldown endpoints', async () => {
    const getSpy = vi.fn().mockReturnValue(of({ items: [], alerts: [] }));

    TestBed.configureTestingModule({
      providers: [
        PlatformDashboardApiService,
        { provide: ApiClient, useValue: { get: getSpy } },
      ],
    });

    const service = TestBed.inject(PlatformDashboardApiService);

    await service.getSummary({ dateFrom: '2026-01-01T00:00:00Z', dateTo: '2026-01-02T00:00:00Z', threshold: 5 });
    await service.getTopTenants({ dateFrom: '2026-01-01', dateTo: '2026-01-31', top: 5, includeInactive: true });
    await service.getRecentInventoryAdjustments({ take: 10, reason: 'Manual', tenantId: 'tenant-1', storeId: 'store-1' });
    await service.getOutOfStock({ tenantId: 'tenant-1', storeId: 'store-1', itemType: 'Product', search: 'cafe', onlyTracked: true, top: 20 });
    await service.getSalesTrend({ dateFrom: '2026-01-01', dateTo: '2026-01-31', granularity: 'week' });
    await service.getTopVoidTenants({ dateFrom: '2026-01-01', dateTo: '2026-01-31', top: 9 });
    await service.getStockoutHotspots({ threshold: 3.5, top: 8, itemType: 'Extra' });
    await service.getActivityFeed({ take: 15, eventType: 'InventoryAdjusted' });
    await service.getExecutiveSignals({ dateFrom: '2026-01-01', dateTo: '2026-01-31', previousPeriodCompare: false });
    await service.getAlertDrilldown({ code: 'TENANT_WITHOUT_TEMPLATE', take: 200, tenantId: 'tenant-1' });
    await service.getTenantOverview('tenant-1', { dateFrom: '2026-01-01', dateTo: '2026-01-31', threshold: 4.5 });
    await service.getStoreStockoutDetails('store-1', { itemType: 'Product', search: 'sku', threshold: 3, mode: 'all', take: 120 });
    await service.getAlerts();

    expect(getSpy).toHaveBeenNthCalledWith(
      1,
      '/v1/platform/dashboard/summary?dateFrom=2026-01-01T00%3A00%3A00Z&dateTo=2026-01-02T00%3A00%3A00Z&threshold=5',
    );
    expect(getSpy).toHaveBeenNthCalledWith(
      2,
      '/v1/platform/dashboard/top-tenants?dateFrom=2026-01-01&dateTo=2026-01-31&top=5&includeInactive=true',
    );
    expect(getSpy).toHaveBeenNthCalledWith(
      3,
      '/v1/platform/dashboard/recent-inventory-adjustments?take=10&reason=Manual&tenantId=tenant-1&storeId=store-1',
    );
    expect(getSpy).toHaveBeenNthCalledWith(
      4,
      '/v1/platform/dashboard/out-of-stock?tenantId=tenant-1&storeId=store-1&itemType=Product&search=cafe&onlyTracked=true&top=20',
    );
    expect(getSpy).toHaveBeenNthCalledWith(
      5,
      '/v1/platform/dashboard/sales-trend?dateFrom=2026-01-01&dateTo=2026-01-31&granularity=week',
    );
    expect(getSpy).toHaveBeenNthCalledWith(
      6,
      '/v1/platform/dashboard/top-void-tenants?dateFrom=2026-01-01&dateTo=2026-01-31&top=9',
    );
    expect(getSpy).toHaveBeenNthCalledWith(
      7,
      '/v1/platform/dashboard/stockout-hotspots?threshold=3.5&top=8&itemType=Extra',
    );
    expect(getSpy).toHaveBeenNthCalledWith(
      8,
      '/v1/platform/dashboard/activity-feed?take=15&eventType=InventoryAdjusted',
    );
    expect(getSpy).toHaveBeenNthCalledWith(
      9,
      '/v1/platform/dashboard/executive-signals?dateFrom=2026-01-01&dateTo=2026-01-31&previousPeriodCompare=false',
    );
    expect(getSpy).toHaveBeenNthCalledWith(
      10,
      '/v1/platform/dashboard/alerts/drilldown?code=TENANT_WITHOUT_TEMPLATE&take=200&tenantId=tenant-1',
    );
    expect(getSpy).toHaveBeenNthCalledWith(
      11,
      '/v1/platform/dashboard/tenants/tenant-1/overview?dateFrom=2026-01-01&dateTo=2026-01-31&threshold=4.5',
    );
    expect(getSpy).toHaveBeenNthCalledWith(
      12,
      '/v1/platform/dashboard/stores/store-1/stockout-details?itemType=Product&search=sku&threshold=3&mode=all&take=120',
    );
    expect(getSpy).toHaveBeenNthCalledWith(13, '/v1/platform/dashboard/alerts');
  });
});
