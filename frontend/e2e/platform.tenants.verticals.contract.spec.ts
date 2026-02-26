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
    localStorage.setItem('platform_selected_tenant_id', 'tenant-1');
  }, buildJwt(['SuperAdmin']));
});

test('verticals CRUD ui-contract', async ({ page }) => {
  let verticals = [
    { id: 'vertical-1', name: 'Retail', description: 'shops', isActive: true, createdAtUtc: '2026-01-01', updatedAtUtc: '2026-01-02' },
  ];

  await page.route('**/api/v1/platform/verticals**', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(verticals) });
    }

    if (request.method() === 'POST') {
      verticals = [...verticals, { id: 'vertical-2', name: 'Food', description: 'food', isActive: true, createdAtUtc: '2026-01-01', updatedAtUtc: '2026-01-02' }];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(verticals[1]) });
    }

    if (request.method() === 'PUT') {
      verticals = verticals.map((row) => (row.id === 'vertical-1' ? { ...row, name: 'Retail Updated' } : row));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(verticals[0]) });
    }

    if (request.method() === 'DELETE') {
      verticals = verticals.filter((row) => row.id !== 'vertical-1');
      return route.fulfill({ status: 204, body: '' });
    }

    return route.fulfill({ status: 500, body: '{}' });
  });

  await page.goto('/app/platform/verticals');
  await expect(page.getByTestId('platform-verticals-page')).toBeVisible();

  await page.getByTestId('vertical-create-open').click();
  await page.getByTestId('vertical-form-name').fill('Food');
  await page.getByTestId('vertical-form-description').fill('food');
  await page.getByTestId('vertical-save').click();
  await expect(page.getByTestId('vertical-row-vertical-2')).toBeVisible();

  await page.getByTestId('vertical-edit-vertical-1').click();
  await page.getByTestId('vertical-form-name').fill('Retail Updated');
  await page.getByTestId('vertical-save').click();
  await expect(page.getByTestId('platform-verticals-success')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByTestId('vertical-delete-vertical-1').click();
  await expect(page.getByTestId('vertical-row-vertical-1')).toHaveCount(0);
});

test('tenants CRUD and set context ui-contract', async ({ page }) => {
  let tenants = [
    { id: 'tenant-1', verticalId: 'vertical-1', name: 'Tenant One', slug: 'tenant-one', isActive: true, defaultStoreId: 'store-1', createdAtUtc: '2026-01-01', updatedAtUtc: '2026-01-02' },
  ];
  const verticals = [
    { id: 'vertical-1', name: 'Retail', description: null, isActive: true, createdAtUtc: '2026-01-01', updatedAtUtc: '2026-01-01' },
  ];

  await page.route('**/api/v1/platform/verticals**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(verticals) });
  });

  await page.route('**/api/v1/platform/tenants**', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tenants) });
    }
    if (request.method() === 'POST') {
      tenants = [...tenants, { id: 'tenant-2', verticalId: 'vertical-1', name: 'Tenant Two', slug: 'tenant-two', isActive: true, defaultStoreId: 'store-2', createdAtUtc: '2026-01-01', updatedAtUtc: '2026-01-02' }];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tenants[1]) });
    }
    if (request.method() === 'PUT') {
      tenants = tenants.map((row) => (row.id === 'tenant-1' ? { ...row, name: 'Tenant One Updated' } : row));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tenants[0]) });
    }
    if (request.method() === 'DELETE') {
      tenants = tenants.filter((row) => row.id !== 'tenant-1');
      return route.fulfill({ status: 204, body: '' });
    }

    return route.fulfill({ status: 500, body: '{}' });
  });

  await page.goto('/app/platform/tenants');
  await expect(page.getByTestId('platform-tenants-page')).toBeVisible();
  await expect(page.getByTestId('tenant-context-active-tenant-1')).toBeVisible();

  await page.getByTestId('tenant-create-open').click();
  await page.getByTestId('tenant-form-name').fill('Tenant Two');
  await page.getByTestId('tenant-form-slug').fill('tenant-two');
  await page.getByTestId('tenant-form-vertical').selectOption('vertical-1');
  await page.getByTestId('tenant-save').click();
  await expect(page.getByTestId('tenant-row-tenant-2')).toBeVisible();

  await page.getByTestId('tenant-edit-tenant-1').click();
  await page.getByTestId('tenant-form-name').fill('Tenant One Updated');
  await page.getByTestId('tenant-save').click();
  await expect(page.getByTestId('platform-tenants-success')).toBeVisible();

  await page.getByTestId('tenant-set-context-tenant-2').click();
  await expect(page.getByTestId('tenant-context-active-tenant-2')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByTestId('tenant-delete-tenant-1').click();
  await expect(page.getByTestId('tenant-row-tenant-1')).toHaveCount(0);
});
