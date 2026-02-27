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
      localStorage.setItem('pos_active_store_id', 'store-e2e');
      localStorage.setItem('platform_selected_tenant_id', 'tenant-e2e');
    },
    buildJwt(['SuperAdmin', 'AdminStore', 'Manager', 'TenantAdmin']),
  );
});

test('platform templates list and assign template to tenant', async ({ page }) => {
  const assignBodies: unknown[] = [];
  await page.route('**/api/v1/platform/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith('/catalog-templates') && route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'tpl-1',
            verticalId: 'vert-1',
            name: 'Template Uno',
            version: '1.0',
            isActive: true,
            createdAtUtc: '2026-01-01T00:00:00Z',
            updatedAtUtc: '2026-01-01T00:00:00Z',
          },
        ]),
      });
    }
    if (pathname.includes('/catalog-templates/tenants/') && route.request().method() === 'PUT') {
      assignBodies.push(route.request().postDataJSON());
      return route.fulfill({ status: 204, body: '' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/app/platform/catalog-templates');
  await expect(page.getByTestId('platform-templates-page')).toBeVisible();
  await expect(page.getByTestId('platform-template-row-0')).toBeVisible();

  await page.goto('/app/platform/tenant-template-assignment');
  await page.getByTestId('platform-assign-tenant').fill('tenant-1');
  await page.getByTestId('platform-assign-template').selectOption('tpl-1');
  await page.getByTestId('platform-assign-submit').click();

  expect(assignBodies[0]).toEqual({ catalogTemplateId: 'tpl-1' });
});

test('tenant overrides and availability send expected payloads', async ({ page }) => {
  const overrideBodies: unknown[] = [];
  const availabilityBodies: unknown[] = [];

  await page.route('**/api/v1/pos/catalog/snapshot**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { ETag: '"s1"' },
      contentType: 'application/json',
      body: JSON.stringify({
        storeId: 'store-e2e',
        timeZoneId: 'America/Mexico_City',
        generatedAtUtc: '2026-01-01T00:00:00Z',
        catalogVersion: 'v1',
        etagSeed: 's1',
        categories: [],
        products: [
          {
            id: 'product-1',
            externalCode: null,
            name: 'Producto',
            categoryId: 'c1',
            subcategoryName: null,
            basePrice: 10,
            isActive: true,
            isAvailable: true,
            customizationSchemaId: null,
          },
        ],
        optionSets: [],
        optionItems: [],
        schemas: [],
        selectionGroups: [],
        extras: [],
        includedItems: [],
        overrides: [],
        versionStamp: 'v1',
      }),
    });
  });

  await page.route('**/api/v1/pos/admin/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith('/products') && route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'product-1',
            externalCode: null,
            name: 'Producto',
            categoryId: 'c1',
            subcategoryName: null,
            basePrice: 10,
            isActive: true,
            isAvailable: true,
            customizationSchemaId: null,
          },
        ]),
      });
    }
    if (pathname.endsWith('/categories') && route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'c1', name: 'Cat', sortOrder: 1, isActive: true }]),
      });
    }
    if (pathname.endsWith('/schemas') && route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }
    if (pathname.endsWith('/catalog/store-overrides') && route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }
    if (pathname.endsWith('/catalog/store-overrides') && route.request().method() === 'PUT') {
      overrideBodies.push(route.request().postDataJSON());
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    }
    if (pathname.endsWith('/catalog/availability') && route.request().method() === 'PUT') {
      availabilityBodies.push(route.request().postDataJSON());
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.goto('/app/admin/pos/catalog/products');
  const overrideToggle = page.getByTestId('override-toggle-Product-product-1');
  const availabilityToggle = page.getByTestId('availability-toggle-Product-product-1');

  await expect(overrideToggle).toBeVisible();
  await expect(overrideToggle).toBeEnabled();
  await overrideToggle.click();

  await expect(availabilityToggle).toBeDisabled();
  await overrideToggle.click();

  await expect(availabilityToggle).toBeVisible();
  await expect(availabilityToggle).toBeEnabled();
  await availabilityToggle.click();

  expect(overrideBodies).toEqual([
    { storeId: 'store-e2e', itemType: 'Product', itemId: 'product-1', state: 'Disabled' },
    { storeId: 'store-e2e', itemType: 'Product', itemId: 'product-1', state: 'Enabled' },
  ]);
  expect((availabilityBodies[0] as { itemType: string; itemId: string }).itemType).toBe('Product');
  expect((availabilityBodies[0] as { itemType: string; itemId: string }).itemId).toBe('product-1');
});
