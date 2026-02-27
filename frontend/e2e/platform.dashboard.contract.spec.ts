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

test('platform dashboard v1 ui-contract', async ({ page }) => {
  const capturedTopTenantQueries: string[] = [];
  const capturedOutOfStockQueries: string[] = [];

  await page.route('**/api/v1/platform/dashboard/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/summary')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ activeTenants: 2, inactiveTenants: 0, activeStores: 3, inactiveStores: 0, totalUsers: 10, usersWithoutStoreAssignment: 0, tenantsWithoutCatalogTemplate: 1, storesWithoutAdminStore: 1, salesTodayCount: 4, salesTodayAmount: 1000, salesLast7DaysCount: 20, salesLast7DaysAmount: 4000, openShiftsCount: 2, outOfStockItemsCount: 7, lowStockItemsCount: 9, effectiveDateFromUtc: '2026-01-01T00:00:00Z', effectiveDateToUtc: '2026-01-07T23:59:59Z', effectiveLowStockThreshold: 5 }) });
    }

    if (url.pathname.endsWith('/top-tenants')) {
      capturedTopTenantQueries.push(url.searchParams.toString());
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{ tenantId: 'tenant-1', tenantName: 'Tenant 1', verticalId: 'v1', verticalName: 'Retail', storeCount: 2, salesCount: 10, salesAmount: 3000, averageTicket: 300, voidedSalesCount: 1 }], effectiveDateFromUtc: 'a', effectiveDateToUtc: 'b', top: 10, includeInactive: false }) });
    }

    if (url.pathname.endsWith('/alerts')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ alerts: [{ code: 'TENANT_WITHOUT_TEMPLATE', severity: 'High', count: 1, description: 'desc', topExamples: ['tenant-1'] }] }) });
    }

    if (url.pathname.endsWith('/recent-inventory-adjustments')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{ adjustmentId: 'adj-1', tenantId: 'tenant-1', tenantName: 'Tenant 1', storeId: 'store-1', storeName: 'Store 1', itemType: 'Product', itemId: 'item-1', itemName: 'Item 1', itemSku: 'sku', qtyBefore: 5, qtyDelta: -2, qtyAfter: 3, reason: 'Manual', referenceType: null, referenceId: null, movementKind: 'Out', createdAtUtc: '2026-01-01T00:00:00Z', performedByUserId: null }], take: 20 }) });
    }

    if (url.pathname.endsWith('/out-of-stock')) {
      capturedOutOfStockQueries.push(url.searchParams.toString());
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{ tenantId: 'tenant-1', tenantName: 'Tenant 1', storeId: 'store-1', storeName: 'Store 1', itemType: 'Product', itemId: 'item-1', itemName: 'Item 1', itemSku: 'sku', stockOnHandQty: 0, updatedAtUtc: '2026-01-01T00:00:00Z', lastAdjustmentAtUtc: null }] }) });
    }

    return route.fulfill({ status: 404, body: '{}' });
  });

  await page.goto('/app/platform/dashboard');

  await expect(page.getByTestId('platform-dashboard-page')).toBeVisible();
  await expect(page.getByTestId('platform-kpi-active-tenants')).toContainText('2');
  await expect(page.getByTestId('platform-alert-row-TENANT_WITHOUT_TEMPLATE')).toBeVisible();
  await expect(page.getByTestId('platform-top-tenants-row-tenant-1')).toBeVisible();
  await expect(page.getByTestId('platform-out-of-stock-row-Product-item-1-store-1')).toBeVisible();

  await page.getByTestId('platform-dashboard-refresh').click();
  await expect.poll(() => capturedTopTenantQueries.length).toBeGreaterThan(1);

  await page.getByTestId('platform-top-tenants-filter-date-from').fill('2026-01-01');
  await page.getByTestId('platform-top-tenants-filter-date-to').fill('2026-01-31');
  await page.getByTestId('platform-top-tenants-filter-top').fill('7');
  await page.getByRole('button', { name: 'Aplicar' }).first().click();
  await expect.poll(() => capturedTopTenantQueries[capturedTopTenantQueries.length - 1]).toContain('top=7');

  const outSection = page.getByTestId('platform-out-of-stock');
  await outSection.getByPlaceholder('tenantId').fill('tenant-1');
  await outSection.getByPlaceholder('storeId').fill('store-1');
  await outSection.getByRole('combobox').selectOption('Product');
  await outSection.getByPlaceholder('search').fill('latte');
  await outSection.getByRole('spinbutton').fill('25');
  await outSection.getByRole('button', { name: 'Aplicar' }).click();
  await expect.poll(() => capturedOutOfStockQueries[capturedOutOfStockQueries.length - 1]).toContain('search=latte');
});
