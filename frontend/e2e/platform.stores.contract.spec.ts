import { expect, test } from '@playwright/test';

const buildJwt = (roles: string[]) => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: 'e2e', roles, exp: 4102444800 })).toString(
    'base64url',
  );
  return `${header}.${payload}.sig`;
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    (token: string) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'refresh-e2e');
    },
    buildJwt(['SuperAdmin']),
  );
});

test('platform stores admin v1.1 ui-contract', async ({ page }) => {
  const waitForTenantStoresResponse = () =>
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/platform/tenants/tenant-1/stores') &&
        response.request().method() === 'GET' &&
        response.status() === 200,
    );
  const gotoTenantStores = async (path: string) => {
    const storesResponse = waitForTenantStoresResponse();
    await page.goto(path);
    await storesResponse;
    await expect(page.getByTestId('platform-tenant-stores-page')).toBeVisible();
  };
  const gotoStoreDetails = async (storeId: string, name: string) => {
    const storeDetailsResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/v1/platform/stores/${storeId}`) &&
        response.request().method() === 'GET' &&
        response.status() === 200,
    );
    await page.goto(`/app/platform/stores/${storeId}`);
    await storeDetailsResponse;
    await expect(page.getByTestId('platform-store-details-page')).toBeVisible();
    await expect(page.getByTestId('platform-store-details-name')).toContainText(name);
  };

  let stores = [
    {
      id: 'store-1',
      tenantId: 'tenant-1',
      name: 'Centro',
      isActive: true,
      isDefaultStore: true,
      hasAdminStore: true,
      adminStoreUserCount: 1,
      totalUsersInStore: 5,
      timeZoneId: 'UTC',
      createdAtUtc: '2026-01-01',
      updatedAtUtc: '2026-01-01',
    },
    {
      id: 'store-2',
      tenantId: 'tenant-1',
      name: 'Norte',
      isActive: true,
      isDefaultStore: false,
      hasAdminStore: false,
      adminStoreUserCount: 0,
      totalUsersInStore: 2,
      timeZoneId: 'America/Mexico_City',
      createdAtUtc: '2026-01-01',
      updatedAtUtc: '2026-01-01',
    },
  ];

  const storeDetailsById: Record<string, Record<string, unknown>> = {
    'store-1': {
      id: 'store-1',
      tenantId: 'tenant-1',
      tenantName: 'Tenant Uno',
      name: 'Centro',
      isActive: true,
      isDefaultStore: true,
      hasAdminStore: true,
      adminStoreUserCount: 1,
      totalUsersInStore: 5,
      timeZoneId: 'UTC',
      createdAtUtc: '2026-01-01',
      updatedAtUtc: '2026-01-01',
    },
    'store-2': {
      id: 'store-2',
      tenantId: 'tenant-1',
      tenantName: 'Tenant Uno',
      name: 'Norte',
      isActive: true,
      isDefaultStore: false,
      hasAdminStore: false,
      adminStoreUserCount: 0,
      totalUsersInStore: 2,
      timeZoneId: 'America/Mexico_City',
      createdAtUtc: '2026-01-01',
      updatedAtUtc: '2026-01-01',
    },
  };

  await page.route('**/api/v1/platform/tenants/tenant-1/stores**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(stores),
    });
  });

  await page.route('**/api/v1/platform/tenants/tenant-1/default-store', async (route) => {
    if (route.request().method() === 'PUT') {
      stores = stores.map((item) => ({ ...item, isDefaultStore: item.id === 'store-2' }));
      storeDetailsById['store-1'].isDefaultStore = false;
      storeDetailsById['store-2'].isDefaultStore = true;
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    await route.fulfill({ status: 500, body: '{}' });
  });

  await page.route('**/api/v1/platform/stores/*', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const storeId = path.split('/').at(-1) ?? '';

    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(storeDetailsById[storeId]),
      });
      return;
    }

    await route.fulfill({ status: 500, body: '{}' });
  });

  await page.route('**/api/v1/platform/dashboard/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith('/summary')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          activeTenants: 1,
          inactiveTenants: 0,
          activeStores: stores.length,
          inactiveStores: 0,
          totalUsers: stores.reduce((sum, item) => sum + item.totalUsersInStore, 0),
          usersWithoutStoreAssignment: 0,
          tenantsWithoutCatalogTemplate: 0,
          storesWithoutAdminStore: stores.filter((item) => !item.hasAdminStore).length,
          salesTodayCount: 0,
          salesTodayAmount: 0,
          salesLast7DaysCount: 0,
          salesLast7DaysAmount: 0,
          openShiftsCount: 0,
          outOfStockItemsCount: 0,
          lowStockItemsCount: 0,
          effectiveDateFromUtc: '2026-01-01T00:00:00Z',
          effectiveDateToUtc: '2026-01-07T23:59:59Z',
          effectiveLowStockThreshold: 5,
        }),
      });
    }

    if (url.pathname.endsWith('/top-tenants')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              tenantId: 'tenant-1',
              tenantName: 'Tenant Uno',
              verticalId: 'v1',
              verticalName: 'Retail',
              storeCount: stores.length,
              salesCount: 0,
              salesAmount: 0,
              averageTicket: 0,
              voidedSalesCount: 0,
            },
          ],
          effectiveDateFromUtc: '2026-01-01',
          effectiveDateToUtc: '2026-01-31',
          top: 10,
          includeInactive: false,
        }),
      });
    }

    if (url.pathname.endsWith('/alerts')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ alerts: [] }),
      });
    }

    if (url.pathname.endsWith('/recent-inventory-adjustments')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], take: 20 }),
      });
    }

    if (url.pathname.endsWith('/out-of-stock')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
    }

    if (url.pathname.endsWith('/executive-signals')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          fastestGrowingTenantId: null,
          fastestGrowingTenantName: null,
          salesGrowthRatePercent: 0,
          voidRatePercent: 0,
          tenantsWithNoSalesInRangeCount: 0,
          storesWithNoAdminStoreCount: stores.filter((item) => !item.hasAdminStore).length,
          tenantsWithNoCatalogTemplateCount: 0,
          storesWithOutOfStockCount: 0,
          inventoryAdjustmentCountInRange: 0,
          topRiskTenantId: null,
          topRiskTenantName: null,
          effectiveDateFromUtc: '2026-01-01',
          effectiveDateToUtc: '2026-01-31',
          previousPeriodCompare: true,
        }),
      });
    }

    if (url.pathname.endsWith('/sales-trend')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [],
          effectiveDateFromUtc: '2026-01-01',
          effectiveDateToUtc: '2026-01-31',
          granularity: 'day',
        }),
      });
    }

    if (url.pathname.endsWith('/top-void-tenants')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [],
          effectiveDateFromUtc: '2026-01-01',
          effectiveDateToUtc: '2026-01-31',
          top: 10,
        }),
      });
    }

    if (url.pathname.endsWith('/stockout-hotspots')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [],
          threshold: 5,
          top: 10,
          itemType: null,
        }),
      });
    }

    if (url.pathname.endsWith('/activity-feed')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [],
          take: 20,
          eventType: null,
        }),
      });
    }

    return route.fulfill({ status: 404, body: '{}' });
  });

  await page.route('**/api/v1/admin/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/admin/roles')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ name: 'AdminStore' }]),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/api/v1/pos/admin/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await gotoStoreDetails('store-2', 'Norte');
  await expect(page.getByTestId('platform-store-details-primary-action')).toBeVisible();
  await expect(page.getByTestId('platform-store-details-action-create-adminstore')).toBeVisible();
  await expect(page.getByTestId('platform-store-details-default')).toContainText(
    'Sucursal regular',
  );
  await expect(page.getByTestId('platform-store-details-has-admin')).toContainText(
    'Sin AdminStore',
  );
  await expect(page.getByTestId('platform-store-details-admin-count')).toContainText('0');
  await expect(page.getByTestId('platform-store-details-users-count')).toContainText('2');
  await Promise.all([
    page.waitForURL(
      '/app/admin/users?tenantId=tenant-1&storeId=store-2&intent=create-user&suggestedRole=AdminStore',
    ),
    page.getByTestId('platform-store-details-action-create-adminstore').click({ force: true }),
  ]);

  await gotoStoreDetails('store-1', 'Centro');
  await expect(page.getByTestId('platform-store-details-action-create-adminstore')).toHaveCount(0);
  await expect(page.getByTestId('platform-store-details-primary-action-users')).toBeVisible();
  await Promise.all([
    page.waitForURL('/app/admin/users?tenantId=tenant-1&storeId=store-1'),
    page.getByTestId('platform-store-details-primary-action-users').click({ force: true }),
  ]);

  await gotoTenantStores('/app/platform/tenants/tenant-1/stores');
  await expect(page.getByTestId('platform-tenant-stores-row-store-2')).toBeVisible();
  await expect(page.getByTestId('platform-tenant-stores-users-store-2')).toBeVisible();
  await expect(page.getByTestId('platform-tenant-stores-dashboard-store-2')).toBeVisible();
  await expect(page.getByTestId('platform-tenant-stores-inventory-store-2')).toBeVisible();
  await expect(page.getByTestId('platform-tenant-stores-default-store-1')).toContainText(
    'Principal',
  );
  await expect(page.getByTestId('platform-tenant-stores-has-admin-store-2')).toContainText(
    'Sin AdminStore',
  );
  await expect(page.getByTestId('platform-tenant-stores-create-adminstore-store-2')).toBeVisible();
  await Promise.all([
    page.waitForURL(
      /\/app\/admin\/users\?tenantId=tenant-1&storeId=store-2&intent=create-user&suggestedRole=AdminStore/,
    ),
    page.getByTestId('platform-tenant-stores-create-adminstore-store-2').click({ force: true }),
  ]);

  await gotoTenantStores('/app/platform/tenants/tenant-1/stores?withoutAdminStore=true');
  await expect(page.getByTestId('platform-tenant-stores-row-store-2')).toBeVisible();
  await expect(page.getByTestId('platform-tenant-stores-context-without-admin')).toBeVisible();
  await expect(page.getByTestId('platform-tenant-stores-context-badge')).toBeVisible();
  await Promise.all([
    page.waitForURL('/app/platform/dashboard?tenantId=tenant-1&storeId=store-2'),
    page.getByTestId('platform-tenant-stores-dashboard-store-2').click({ force: true }),
  ]);

  await gotoTenantStores('/app/platform/tenants/tenant-1/stores?withoutAdminStore=true');
  await expect(page.getByTestId('platform-tenant-stores-row-store-2')).toBeVisible();
  await Promise.all([
    page.waitForURL('/app/admin/users?tenantId=tenant-1&storeId=store-2'),
    page.getByTestId('platform-tenant-stores-users-store-2').click({ force: true }),
  ]);

  await gotoTenantStores('/app/platform/tenants/tenant-1/stores');
  await expect(page.getByTestId('platform-tenant-stores-row-store-2')).toBeVisible();
  await Promise.all([
    page.waitForURL('/app/platform/stores/store-2'),
    page.getByTestId('platform-tenant-stores-view-details-store-2').click({ force: true }),
  ]);

  await gotoTenantStores('/app/platform/tenants/tenant-1/stores');
  await expect(page.getByTestId('platform-tenant-stores-row-store-2')).toBeVisible();
  await page.getByTestId('platform-tenant-stores-set-default-store-2').click();
  await expect(page.getByTestId('platform-tenant-stores-default-store-2')).toContainText(
    'Principal',
  );

  await gotoStoreDetails('store-2', 'Norte');
  await expect(page.getByTestId('platform-store-details-default')).toContainText(
    'Sucursal principal',
  );

  await gotoStoreDetails('store-2', 'Norte');
  await Promise.all([
    page.waitForURL('/app/platform/dashboard?tenantId=tenant-1&storeId=store-2'),
    page.getByTestId('platform-store-details-action-dashboard').click({ force: true }),
  ]);

  await gotoStoreDetails('store-2', 'Norte');
  await Promise.all([
    page.waitForURL('/app/admin/pos/inventory?tenantId=tenant-1&storeId=store-2'),
    page.getByTestId('platform-store-details-action-inventory').click({ force: true }),
  ]);
});
