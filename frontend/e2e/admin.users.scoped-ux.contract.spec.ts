import { expect, test } from '@playwright/test';

const buildJwt = (roles: string[], tenantId?: string, storeId?: string) => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'e2e-admin-users',
      roles,
      tenantId,
      storeId,
      exp: 4102444800,
    }),
  ).toString('base64url');
  return `${header}.${payload}.sig`;
};

const usersResponse = {
  items: [
    {
      id: 'user-1',
      email: 'user1@test.local',
      userName: 'User 1',
      isLockedOut: false,
      roles: ['TenantAdmin'],
      tenantId: 'tenant-1',
      storeId: null,
    },
    {
      id: 'user-2',
      email: 'user2@test.local',
      userName: 'User 2',
      isLockedOut: false,
      roles: ['AdminStore'],
      tenantId: 'tenant-1',
      storeId: 'store-1',
    },
  ],
  totalCount: 2,
  pageNumber: 1,
  pageSize: 20,
};

test('SuperAdmin sees tenant/store filters and store requirement for AdminStore/Cashier roles', async ({
  page,
}) => {
  await page.addInitScript(
    (token: string) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'refresh-e2e');
    },
    buildJwt(['SuperAdmin']),
  );

  await page.route('**/api/v1/admin/roles', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { name: 'SuperAdmin' },
        { name: 'TenantAdmin' },
        { name: 'AdminStore' },
        { name: 'Manager' },
        { name: 'Cashier' },
      ]),
    }),
  );
  await page.route('**/api/v1/admin/users**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(usersResponse),
    }),
  );

  await page.goto('/app/admin/users');

  await expect(page.getByTestId('admin-users-page')).toBeVisible();
  await expect(page.getByTestId('admin-users-filter-tenant')).toBeVisible();
  await expect(page.getByTestId('admin-users-filter-store')).toBeVisible();

  const firstUserRow = page.getByTestId('admin-users-row-user-1');
  const firstUserRoleSelect = firstUserRow.getByTestId('admin-user-form-role');
  const firstUserStoreRequiredHint = firstUserRow.getByTestId('admin-user-form-store-required');

  await firstUserRoleSelect.selectOption('AdminStore');
  await expect(firstUserStoreRequiredHint).toBeVisible();
  await firstUserRoleSelect.selectOption('Cashier');
  await expect(firstUserStoreRequiredHint).toBeVisible();
  await firstUserRoleSelect.selectOption('TenantAdmin');
  await expect(firstUserStoreRequiredHint).toBeHidden();
});

test('TenantAdmin and AdminStore stay scoped by tenant/store filters', async ({ page }) => {
  await page.route('**/api/v1/admin/roles', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { name: 'TenantAdmin' },
        { name: 'AdminStore' },
        { name: 'Manager' },
        { name: 'Cashier' },
      ]),
    }),
  );
  await page.route('**/api/v1/admin/users**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(usersResponse),
    }),
  );

  await page.goto('/');
  await page.evaluate((token: string) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('refresh_token', 'refresh-e2e');
  }, buildJwt(['TenantAdmin'], 'tenant-1'));
  await page.goto('/app/admin/users');
  await expect(page.getByTestId('admin-users-filter-tenant')).toBeDisabled();
  await expect(page.getByTestId('admin-users-filter-store')).not.toBeDisabled();

  await page.evaluate(
    (token: string) => {
      localStorage.setItem('access_token', token);
    },
    buildJwt(['AdminStore'], 'tenant-1', 'store-1'),
  );
  await page.reload();

  await expect(page.getByTestId('admin-users-filter-store')).toBeDisabled();
  await expect(page.getByTestId('admin-users-scope-badge')).toContainText('Vista de sucursal');
});
