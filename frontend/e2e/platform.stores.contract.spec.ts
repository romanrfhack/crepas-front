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

test('platform stores admin v1.1 ui-contract', async ({ page }) => {
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

  await page.route('**/api/v1/platform/tenants/tenant-1/stores', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stores) });
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

  await page.route('**/api/v1/admin/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/admin/roles')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ name: 'AdminStore' }]) });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.goto('/app/platform/stores/store-2');
  await expect(page.getByTestId('platform-store-details-page')).toBeVisible();
  await expect(page.getByTestId('platform-store-details-primary-action')).toBeVisible();
  await expect(page.getByTestId('platform-store-details-action-create-adminstore')).toBeVisible();
  await expect(page.getByTestId('platform-store-details-default')).toContainText('Sucursal regular');
  await expect(page.getByTestId('platform-store-details-has-admin')).toContainText('Sin AdminStore');
  await expect(page.getByTestId('platform-store-details-admin-count')).toContainText('0');
  await expect(page.getByTestId('platform-store-details-users-count')).toContainText('2');
  await page.getByTestId('platform-store-details-action-create-adminstore').click();
  await expect(page).toHaveURL('/app/admin/users?tenantId=tenant-1&storeId=store-2&intent=create-user&suggestedRole=AdminStore');

  await page.goto('/app/platform/stores/store-1');
  await expect(page.getByTestId('platform-store-details-action-create-adminstore')).toHaveCount(0);
  await expect(page.getByTestId('platform-store-details-action-users')).toBeVisible();
  await page.getByTestId('platform-store-details-action-users').click();
  await expect(page).toHaveURL('/app/admin/users?tenantId=tenant-1&storeId=store-1');

  await page.goto('/app/platform/tenants/tenant-1/stores');
  await expect(page.getByTestId('platform-tenant-stores-page')).toBeVisible();
  await expect(page.getByTestId('platform-tenant-stores-users-store-2')).toBeVisible();
  await expect(page.getByTestId('platform-tenant-stores-dashboard-store-2')).toBeVisible();
  await expect(page.getByTestId('platform-tenant-stores-inventory-store-2')).toBeVisible();
  await expect(page.getByTestId('platform-tenant-stores-default-store-1')).toContainText('Principal');
  await expect(page.getByTestId('platform-tenant-stores-has-admin-store-2')).toContainText('Sin AdminStore');
  await expect(page.getByTestId('platform-tenant-stores-create-adminstore-store-2')).toBeVisible();
  await page.getByTestId('platform-tenant-stores-create-adminstore-store-2').click();
  await expect(page).toHaveURL(/\/app\/admin\/users\?tenantId=tenant-1&storeId=store-2&intent=create-user&suggestedRole=AdminStore/);


  await page.goto('/app/platform/tenants/tenant-1/stores?withoutAdminStore=true');
  await expect(page.getByTestId('platform-tenant-stores-context-without-admin')).toBeVisible();
  await expect(page.getByTestId('platform-tenant-stores-context-badge')).toBeVisible();
  await page.getByTestId('platform-tenant-stores-dashboard-store-2').click();
  await expect(page).toHaveURL('/app/platform/dashboard?tenantId=tenant-1&storeId=store-2');

  await page.goto('/app/platform/tenants/tenant-1/stores?withoutAdminStore=true');
  await page.getByTestId('platform-tenant-stores-users-store-2').click();
  await expect(page).toHaveURL('/app/admin/users?tenantId=tenant-1&storeId=store-2');

  await page.goto('/app/platform/tenants/tenant-1/stores');
  await page.getByTestId('platform-tenant-stores-view-details-store-2').click();
  await expect(page).toHaveURL('/app/platform/stores/store-2');

  await page.goto('/app/platform/tenants/tenant-1/stores');
  await page.getByTestId('platform-tenant-stores-set-default-store-2').click();
  await expect(page.getByTestId('platform-tenant-stores-default-store-2')).toContainText('Principal');

  await page.goto('/app/platform/stores/store-2');
  await expect(page.getByTestId('platform-store-details-default')).toContainText('Sucursal principal');

  await page.goto('/app/platform/stores/store-2');
  await page.getByTestId('platform-store-details-action-dashboard').click();
  await expect(page).toHaveURL('/app/platform/dashboard?tenantId=tenant-1&storeId=store-2');

  await page.goto('/app/platform/stores/store-2');
  await page.getByTestId('platform-store-details-action-inventory').click();
  await expect(page).toHaveURL('/app/admin/pos/inventory?tenantId=tenant-1&storeId=store-2');

});
