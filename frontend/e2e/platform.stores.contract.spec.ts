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

test('platform stores admin v1 ui-contract', async ({ page }) => {
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

  const updatedStore = {
    id: 'store-2',
    tenantId: 'tenant-1',
    tenantName: 'Tenant Uno',
    name: 'Norte Editada',
    isActive: true,
    isDefaultStore: false,
    hasAdminStore: false,
    adminStoreUserCount: 0,
    totalUsersInStore: 2,
    timeZoneId: 'UTC',
    createdAtUtc: '2026-01-01',
    updatedAtUtc: '2026-01-02',
  };

  await page.route('**/api/v1/platform/tenants/tenant-1/stores', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stores) });
  });

  await page.route('**/api/v1/platform/tenants/tenant-1/default-store', async (route) => {
    if (route.request().method() === 'PUT') {
      stores = stores.map((item) => ({ ...item, isDefaultStore: item.id === 'store-2' }));
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    await route.fulfill({ status: 500, body: '{}' });
  });

  await page.route('**/api/v1/platform/stores/store-2', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(updatedStore) });
      return;
    }
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as { name: string; timeZoneId: string; isActive: boolean };
      updatedStore.name = body.name;
      updatedStore.timeZoneId = body.timeZoneId;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(updatedStore) });
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

  await page.goto('/app/platform/tenants/tenant-1/stores');
  await expect(page.getByTestId('platform-tenant-stores-page')).toBeVisible();
  await expect(page.getByTestId('platform-tenant-stores-row-store-1')).toBeVisible();
  await expect(page.getByTestId('platform-tenant-stores-default-1')).toContainText('Sí');
  await expect(page.getByTestId('platform-tenant-stores-has-admin-2')).toContainText('No');

  await page.getByTestId('platform-tenant-stores-set-default-2').click();
  await expect(page.getByTestId('platform-tenant-stores-default-2')).toContainText('Sí');

  await page.getByTestId('platform-tenant-stores-edit-2').click();
  await expect(page.getByTestId('platform-store-details-page')).toBeVisible();
  await page.getByTestId('platform-store-edit-open').click();
  await page.getByTestId('platform-store-edit-name').fill('Norte Editada');
  await page.getByTestId('platform-store-edit-timezone').fill('UTC');
  await page.getByTestId('platform-store-edit-submit').click();
  await expect(page.getByTestId('platform-store-edit-success')).toBeVisible();

  await page.getByTestId('platform-store-details-action-users').click();
  await expect(page).toHaveURL('/app/admin/users?tenantId=tenant-1&storeId=store-2');

  await page.goto('/app/platform/stores/store-2');
  await page.getByTestId('platform-store-details-action-create-adminstore').click();
  await expect(page).toHaveURL('/app/admin/users?tenantId=tenant-1&storeId=store-2&intent=create-user&suggestedRole=AdminStore');

  await page.goto('/app/platform/stores/store-2');
  await page.getByTestId('platform-store-details-action-create-user').click();
  await expect(page).toHaveURL('/app/admin/users?tenantId=tenant-1&storeId=store-2&intent=create-user');

  await page.goto('/app/platform/stores/store-2');
  await page.getByTestId('platform-store-details-action-inventory').click();
  await expect(page).toHaveURL('/app/admin/pos/inventory?tenantId=tenant-1&storeId=store-2');

  await page.goto('/app/platform/stores/store-2');
  await page.getByTestId('platform-store-details-action-reports').click();
  await expect(page).toHaveURL('/app/platform/dashboard?tenantId=tenant-1&storeId=store-2');

  await page.goto('/app/platform/tenants/tenant-1/stores');
  await page.getByTestId('platform-tenant-stores-create-adminstore-2').click();
  await expect(page).toHaveURL(/\/app\/admin\/users\?tenantId=tenant-1&storeId=store-2&intent=create-user&suggestedRole=AdminStore/);
});
