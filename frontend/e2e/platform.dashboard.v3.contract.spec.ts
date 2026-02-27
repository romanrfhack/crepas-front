import { expect, test } from '@playwright/test';

const buildJwt = (roles: string[]) => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: 'e2e', roles, exp: 4102444800 })).toString('base64url');
  return `${header}.${payload}.sig`;
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript((token: string) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('refresh_token', 'refresh-e2e');
  }, buildJwt(['SuperAdmin']));
});

test('platform dashboard v3 drilldown ui-contract', async ({ page }) => {
  const captured = {
    alertDrilldown: [] as string[],
    tenantOverview: [] as string[],
    stockoutDetails: [] as string[],
  };

  await page.route('**/api/v1/platform/dashboard/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith('/summary')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ activeTenants: 2, inactiveTenants: 0, activeStores: 3, inactiveStores: 0, totalUsers: 10, usersWithoutStoreAssignment: 0, tenantsWithoutCatalogTemplate: 1, storesWithoutAdminStore: 1, salesTodayCount: 4, salesTodayAmount: 1000, salesLast7DaysCount: 20, salesLast7DaysAmount: 4000, openShiftsCount: 2, outOfStockItemsCount: 7, lowStockItemsCount: 9, effectiveDateFromUtc: '2026-01-01T00:00:00Z', effectiveDateToUtc: '2026-01-07T23:59:59Z', effectiveLowStockThreshold: 5 }) });
    }

    if (url.pathname.endsWith('/top-tenants')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{ tenantId: 'tenant-1', tenantName: 'Tenant 1', verticalId: 'v1', verticalName: 'Retail', storeCount: 2, salesCount: 10, salesAmount: 3000, averageTicket: 300, voidedSalesCount: 1 }], effectiveDateFromUtc: 'a', effectiveDateToUtc: 'b', top: 10, includeInactive: false }) });
    }

    if (url.pathname.endsWith('/alerts')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ alerts: [{ code: 'TENANT_WITHOUT_TEMPLATE', severity: 'High', count: 1, description: 'Missing template', topExamples: [] }] }) });
    }

    if (url.pathname.endsWith('/alerts/drilldown')) {
      captured.alertDrilldown.push(url.searchParams.toString());
      if (url.searchParams.get('code') === 'TENANT_WITHOUT_TEMPLATE') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          code: 'TENANT_WITHOUT_TEMPLATE',
          items: [{ tenantId: 'tenant-1', tenantName: 'Tenant 1', storeId: null, storeName: null, userId: null, userName: null, email: null, role: null, description: 'Tenant sin template', reason: 'MissingTemplate', metadata: null }],
        }) });
      }

      return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Invalid alert code.' }) });
    }

    if (url.pathname.endsWith('/recent-inventory-adjustments')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], take: 20 }) });
    }

    if (url.pathname.endsWith('/out-of-stock')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
    }

    if (url.pathname.endsWith('/executive-signals')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        fastestGrowingTenantId: 'tenant-1',
        fastestGrowingTenantName: 'Tenant 1',
        salesGrowthRatePercent: 14,
        voidRatePercent: 4,
        tenantsWithNoSalesInRangeCount: 2,
        storesWithNoAdminStoreCount: 1,
        tenantsWithNoCatalogTemplateCount: 3,
        storesWithOutOfStockCount: 4,
        inventoryAdjustmentCountInRange: 7,
        topRiskTenantId: 'tenant-2',
        topRiskTenantName: 'Tenant 2',
        effectiveDateFromUtc: '2026-01-01',
        effectiveDateToUtc: '2026-01-31',
        previousPeriodCompare: true,
      }) });
    }

    if (url.pathname.endsWith('/sales-trend')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        items: [{ bucketStartUtc: '2026-01-01T00:00:00Z', bucketLabel: '2026-01-01', salesCount: 11, salesAmount: 5000, voidedSalesCount: 1, averageTicket: 454.54 }],
        effectiveDateFromUtc: '2026-01-01',
        effectiveDateToUtc: '2026-01-31',
        granularity: 'day',
      }) });
    }

    if (url.pathname.endsWith('/top-void-tenants')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        items: [{ tenantId: 'tenant-v', tenantName: 'Tenant Void', verticalId: 'v1', verticalName: 'Retail', voidedSalesCount: 3, voidedSalesAmount: 400, totalSalesCount: 60, voidRate: 0.05, storeCount: 2 }],
        effectiveDateFromUtc: '2026-01-01',
        effectiveDateToUtc: '2026-01-31',
        top: 10,
      }) });
    }

    if (url.pathname.endsWith('/stockout-hotspots')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        items: [{ tenantId: 'tenant-1', tenantName: 'Tenant 1', storeId: 'store-1', storeName: 'Store 1', outOfStockItemsCount: 6, lowStockItemsCount: 8, lastInventoryMovementAtUtc: '2026-01-01', trackedItemsCount: 40 }],
        threshold: 5,
        top: 10,
        itemType: null,
      }) });
    }

    if (url.pathname.includes('/tenants/') && url.pathname.endsWith('/overview')) {
      captured.tenantOverview.push(url.pathname);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        tenantId: 'tenant-1',
        tenantName: 'Tenant 1',
        verticalId: 'v1',
        verticalName: 'Retail',
        storeCount: 2,
        activeStoreCount: 2,
        totalUsers: 11,
        usersWithoutStoreAssignmentCount: 1,
        salesInRangeCount: 12,
        salesInRangeAmount: 12000,
        voidedSalesCount: 2,
        outOfStockItemsCount: 6,
        lowStockItemsCount: 9,
        lastInventoryAdjustmentAtUtc: '2026-01-02T01:00:00Z',
        hasCatalogTemplate: true,
        storesWithoutAdminStoreCount: 1,
        effectiveDateFromUtc: '2026-01-01',
        effectiveDateToUtc: '2026-01-31',
        effectiveThreshold: 5,
      }) });
    }

    if (url.pathname.includes('/stores/') && url.pathname.endsWith('/stockout-details')) {
      captured.stockoutDetails.push(url.searchParams.toString());
      if (url.searchParams.get('mode') === 'low-stock') {
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'boom' }) });
      }

      if (url.searchParams.get('search') === 'EMPTY') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          storeId: 'store-1',
          storeName: 'Store 1',
          tenantId: 'tenant-1',
          tenantName: 'Tenant 1',
          mode: 'all',
          effectiveThreshold: 3,
          items: [],
        }) });
      }

      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        storeId: 'store-1',
        storeName: 'Store 1',
        tenantId: 'tenant-1',
        tenantName: 'Tenant 1',
        mode: 'out-of-stock',
        effectiveThreshold: 5,
        items: [{ itemType: 'Product', itemId: 'item-1', itemName: 'Item 1', itemSku: 'SKU-1', stockOnHandQty: 0, isInventoryTracked: true, availabilityReason: 'OutOfStock', lastAdjustmentAtUtc: '2026-01-02T01:00:00Z' }],
      }) });
    }

    if (url.pathname.endsWith('/activity-feed')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        items: [{ eventType: 'InventoryAdjusted', occurredAtUtc: '2026-01-01', tenantId: 'tenant-1', tenantName: 'Tenant 1', storeId: 'store-1', storeName: 'Store 1', title: 'Inventory adjusted', description: 'desc', referenceId: 'ref-1', severity: 'medium', actorUserId: 'u-1' }],
        take: 20,
        eventType: null,
      }) });
    }

    return route.fulfill({ status: 404, body: '{}' });
  });

  await page.goto('/app/platform/dashboard');
  await expect(page.getByTestId('platform-dashboard-page')).toBeVisible();

  await page.getByTestId('platform-alert-drilldown-open-TENANT_WITHOUT_TEMPLATE').click();
  await expect(page.getByTestId('platform-alert-drilldown')).toBeVisible();
  await expect(page.getByTestId('platform-alert-drilldown-row-0')).toBeVisible();
  await expect.poll(() => captured.alertDrilldown.at(-1)).toContain('code=TENANT_WITHOUT_TEMPLATE');
  await page.getByTestId('platform-alert-drilldown-close').click();

  await page.getByTestId('platform-tenant-overview-open-tenant-1').click();
  await expect(page.getByTestId('platform-tenant-overview')).toBeVisible();
  await expect(page.getByTestId('platform-tenant-overview-metric-tenantName')).toBeVisible();
  await expect.poll(() => captured.tenantOverview.at(-1)).toContain('/tenants/tenant-1/overview');
  await page.getByTestId('platform-tenant-overview-close').click();

  await page.getByTestId('platform-store-stockout-open-store-1').click();
  await expect(page.getByTestId('platform-store-stockout-details')).toBeVisible();
  await expect(page.getByTestId('platform-store-stockout-row-0')).toBeVisible();

  await page.getByTestId('platform-store-stockout-filter-item-type').selectOption('Product');
  await page.getByTestId('platform-store-stockout-filter-search').fill('EMPTY');
  await page.getByTestId('platform-store-stockout-filter-threshold').fill('3');
  await page.getByTestId('platform-store-stockout-filter-mode').selectOption('all');
  await page.getByTestId('platform-store-stockout-details').getByRole('button', { name: 'Aplicar' }).click();
  await expect(page.getByTestId('platform-store-stockout-empty')).toBeVisible();
  await expect.poll(() => captured.stockoutDetails.at(-1)).toContain('mode=all');

  await page.getByTestId('platform-store-stockout-filter-search').fill('SKU');
  await page.getByTestId('platform-store-stockout-filter-mode').selectOption('low-stock');
  await page.getByTestId('platform-store-stockout-details').getByRole('button', { name: 'Aplicar' }).click();
  await expect(page.getByTestId('platform-store-stockout-error')).toBeVisible();
});
