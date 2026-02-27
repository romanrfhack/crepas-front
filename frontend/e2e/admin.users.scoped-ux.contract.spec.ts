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

const rolesResponse = [
  { name: 'SuperAdmin' },
  { name: 'TenantAdmin' },
  { name: 'AdminStore' },
  { name: 'Manager' },
  { name: 'Cashier' },
];

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
  ],
  totalCount: 1,
  pageNumber: 1,
  pageSize: 20,
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    (token: string) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'refresh-e2e');
    },
    buildJwt(['SuperAdmin']),
  );

  await page.route('**/api/v1/admin/roles', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rolesResponse) }),
  );
});

test('create user success from tenant+store context submits POST and refreshes list', async ({ page }) => {
  let getUsersCalls = 0;
  await page.route('**/api/v1/admin/users**', (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      getUsersCalls += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(usersResponse),
      });
    }

    if (method === 'POST') {
      const body = route.request().postDataJSON();
      expect(body).toEqual({
        email: 'new@test.local',
        userName: 'new-user',
        role: 'AdminStore',
        tenantId: 'tenant-ctx',
        storeId: 'store-ctx',
        temporaryPassword: 'Temp123!',
      });
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-2',
          email: 'new@test.local',
          userName: 'new-user',
          roles: ['AdminStore'],
          tenantId: 'tenant-ctx',
          storeId: 'store-ctx',
          isLockedOut: false,
        }),
      });
    }

    return route.continue();
  });

  await page.goto('/app/admin/users?tenantId=tenant-ctx&storeId=store-ctx');
  await page.getByTestId('admin-users-create-open').click();

  await expect(page.getByTestId('admin-users-create-context-tenant')).toContainText('tenant-ctx');
  await expect(page.getByTestId('admin-users-create-context-store')).toContainText('store-ctx');
  await expect(page.getByTestId('admin-user-form-role-suggestion')).toContainText('AdminStore');

  await page.getByTestId('admin-user-form-email').fill('new@test.local');
  await page.getByTestId('admin-user-form-username').fill('new-user');
  await page.getByTestId('admin-user-form-password').fill('Temp123!');
  await page
    .getByTestId('admin-users-create-context-badge')
    .getByTestId('admin-user-form-submit')
    .click();

  await expect(page.getByTestId('admin-user-form-success')).toBeVisible();
  await expect(page.getByTestId('admin-user-form-error')).toHaveCount(0);
  expect(getUsersCalls).toBeGreaterThanOrEqual(2);
});

test('create user error maps conflict and validation responses with stable error testid', async ({ page }) => {
  await page.route('**/api/v1/admin/users**', async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(usersResponse),
      });
    }

    const body = route.request().postDataJSON() as { email: string };
    if (body.email === 'dup@test.local') {
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'El email ya existe.' }),
      });
    }

    return route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ errors: { storeId: ['Store no pertenece al tenant.'] } }),
    });
  });

  await page.goto('/app/admin/users?tenantId=tenant-ctx&storeId=store-ctx');
  await page.getByTestId('admin-users-create-open').click();

  await page.getByTestId('admin-user-form-email').fill('dup@test.local');
  await page.getByTestId('admin-user-form-username').fill('dup-user');
  await page.getByTestId('admin-user-form-password').fill('Temp123!');
  await page
    .getByTestId('admin-users-create-context-badge')
    .getByTestId('admin-user-form-submit')
    .click();
  await expect(page.getByTestId('admin-user-form-error')).toBeVisible();

  await page.getByTestId('admin-user-form-email').fill('bad-store@test.local');
  await page
    .getByTestId('admin-users-create-context-badge')
    .getByTestId('admin-user-form-submit')
    .click();
  await expect(page.getByTestId('admin-user-form-error')).toBeVisible();
});

test('tenant-only context keeps tenant prefill and suggested tenant role', async ({ page }) => {
  await page.route('**/api/v1/admin/users**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(usersResponse) }),
  );

  await page.goto('/app/admin/users?tenantId=tenant-only');
  await page.getByTestId('admin-users-create-open').click();

  await expect(page.getByTestId('admin-users-create-context-tenant')).toContainText('tenant-only');
  await expect(page.getByTestId('admin-users-create-context-store')).toContainText('N/A');
  await expect(page.getByTestId('admin-user-form-role-suggestion')).toContainText('TenantAdmin');
});
