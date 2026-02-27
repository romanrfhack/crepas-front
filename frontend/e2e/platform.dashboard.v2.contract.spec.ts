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

test('platform dashboard v2 ui-contract', async ({ page }) => {
  const captured = {
    salesTrend: [] as string[],
    topVoid: [] as string[],
    hotspots: [] as string[],
    feed: [] as string[],
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
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ alerts: [] }) });
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
      captured.salesTrend.push(url.searchParams.toString());
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        items: [{ bucketStartUtc: '2026-01-01T00:00:00Z', bucketLabel: '2026-01-01', salesCount: 11, salesAmount: 5000, voidedSalesCount: 1, averageTicket: 454.54 }],
        effectiveDateFromUtc: '2026-01-01',
        effectiveDateToUtc: '2026-01-31',
        granularity: 'day',
      }) });
    }

    if (url.pathname.endsWith('/top-void-tenants')) {
      captured.topVoid.push(url.searchParams.toString());
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        items: [{ tenantId: 'tenant-v', tenantName: 'Tenant Void', verticalId: 'v1', verticalName: 'Retail', voidedSalesCount: 3, voidedSalesAmount: 400, totalSalesCount: 60, voidRate: 0.05, storeCount: 2 }],
        effectiveDateFromUtc: '2026-01-01',
        effectiveDateToUtc: '2026-01-31',
        top: 10,
      }) });
    }

    if (url.pathname.endsWith('/stockout-hotspots')) {
      captured.hotspots.push(url.searchParams.toString());
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        items: [{ tenantId: 'tenant-1', tenantName: 'Tenant 1', storeId: 'store-1', storeName: 'Store 1', outOfStockItemsCount: 6, lowStockItemsCount: 8, lastInventoryMovementAtUtc: '2026-01-01', trackedItemsCount: 40 }],
        threshold: 5,
        top: 10,
        itemType: null,
      }) });
    }

    if (url.pathname.endsWith('/activity-feed')) {
      captured.feed.push(url.searchParams.toString());
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
  await expect(page.getByTestId('platform-executive-signals')).toBeVisible();
  await expect(page.getByTestId('platform-executive-signal-growth')).toBeVisible();
  await expect(page.getByTestId('platform-sales-trend-row-0')).toBeVisible();
  await expect(page.getByTestId('platform-top-void-tenant-row-tenant-v')).toBeVisible();
  await expect(page.getByTestId('platform-stockout-hotspot-row-store-1')).toBeVisible();
  await expect(page.getByTestId('platform-activity-feed-row-0')).toBeVisible();

  await page.getByTestId('platform-sales-trend-filter-date-from').fill('2026-01-01');
  await page.getByTestId('platform-sales-trend-filter-date-to').fill('2026-01-31');
  await page.getByTestId('platform-sales-trend-filter-granularity').selectOption('week');
  await page.getByTestId('platform-sales-trend').getByRole('button', { name: 'Aplicar' }).click();
  await expect.poll(() => captured.salesTrend.at(-1)).toContain('granularity=week');

  await page.getByTestId('platform-top-void-tenants-filter-date-from').fill('2026-01-01');
  await page.getByTestId('platform-top-void-tenants-filter-date-to').fill('2026-01-31');
  await page.getByTestId('platform-top-void-tenants-filter-top').fill('8');
  await page.getByTestId('platform-top-void-tenants').getByRole('button', { name: 'Aplicar' }).click();
  await expect.poll(() => captured.topVoid.at(-1)).toContain('top=8');

  await page.getByTestId('platform-stockout-hotspots-filter-threshold').fill('3');
  await page.getByTestId('platform-stockout-hotspots-filter-top').fill('6');
  await page.getByTestId('platform-stockout-hotspots-filter-item-type').selectOption('Product');
  await page.getByTestId('platform-stockout-hotspots').getByRole('button', { name: 'Aplicar' }).click();
  await expect.poll(() => captured.hotspots.at(-1)).toContain('itemType=Product');

  await page.getByTestId('platform-activity-feed-filter-take').fill('9');
  await page.getByTestId('platform-activity-feed-filter-event-type').selectOption('InventoryAdjusted');
  await page.getByTestId('platform-activity-feed').getByRole('button', { name: 'Aplicar' }).click();
  await expect.poll(() => captured.feed.at(-1)).toContain('eventType=InventoryAdjusted');
});
