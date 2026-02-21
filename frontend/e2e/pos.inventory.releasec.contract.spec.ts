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
    localStorage.setItem('pos_active_store_id', 'store-e2e');
    localStorage.setItem('platform_selected_tenant_id', 'tenant-e2e');
  }, buildJwt(['SuperAdmin', 'Admin', 'Manager', 'TenantAdmin', 'Cashier']));
});

test('inventory page updates onHand and settings payloads', async ({ page }) => {
  const inventoryPuts: unknown[] = [];
  const settingsPuts: unknown[] = [];

  await page.route('**/api/v1/pos/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    const method = route.request().method();

    if (pathname.endsWith('/admin/inventory') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            storeId: 'store-e2e',
            productId: 'product-1',
            productName: 'Latte',
            productSku: 'LAT-1',
            onHand: 3,
            reserved: 0,
            updatedAtUtc: '2026-01-01T00:00:00Z',
          },
          {
            storeId: 'store-e2e',
            productId: 'product-2',
            productName: 'Mocha',
            productSku: 'MOC-1',
            onHand: 1,
            reserved: 0,
            updatedAtUtc: '2026-01-01T00:00:00Z',
          },
        ]),
      });
    }

    if (pathname.endsWith('/admin/inventory') && method === 'PUT') {
      inventoryPuts.push(route.request().postDataJSON());
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    }

    if (pathname.endsWith('/admin/inventory/settings') && method === 'PUT') {
      settingsPuts.push(route.request().postDataJSON());
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ showOnlyInStock: true }) });
    }

    if (pathname.endsWith('/catalog/snapshot') && method === 'GET') {
      return route.fulfill({
        status: 200,
        headers: { ETag: '"r1"' },
        contentType: 'application/json',
        body: JSON.stringify({ storeId: 'store-e2e', timeZoneId: 'America/Mexico_City', generatedAtUtc: '2026-01-01T00:00:00Z', catalogVersion: 'v1', etagSeed: 'r1', categories: [], products: [], optionSets: [], optionItems: [], schemas: [], selectionGroups: [], extras: [], includedItems: [], overrides: [], versionStamp: 'v1' }),
      });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/app/admin/pos/inventory');
  await expect(page.getByTestId('inventory-page')).toBeVisible();
  await page.getByTestId('inventory-onhand-product-1').fill('7');
  await page.getByTestId('inventory-save-product-1').click();
  await page.getByTestId('inventory-settings-showOnlyInStock').check();
  await page.getByTestId('inventory-settings-save').click();

  expect(inventoryPuts[0]).toEqual({ storeId: 'store-e2e', productId: 'product-1', onHand: 7 });
  expect(settingsPuts[0]).toEqual({ showOnlyInStock: true });
});

test('pos checkout shows outofstock alert contract', async ({ page }) => {
  await page.route('**/api/v1/pos/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    const method = route.request().method();

    if (pathname.endsWith('/catalog/snapshot') && method === 'GET') {
      return route.fulfill({
        status: 200,
        headers: { ETag: '"snap"' },
        contentType: 'application/json',
        body: JSON.stringify({
          storeId: 'store-e2e',
          timeZoneId: 'America/Mexico_City',
          generatedAtUtc: '2026-01-01T00:00:00Z',
          catalogVersion: 'v1',
          etagSeed: 'snap',
          categories: [{ id: 'cat-1', name: 'Cafe', sortOrder: 1, isActive: true }],
          products: [{ id: 'product-1', externalCode: null, name: 'Latte', categoryId: 'cat-1', subcategoryName: null, basePrice: 10, isActive: true, isAvailable: true, customizationSchemaId: null }],
          optionSets: [], optionItems: [], schemas: [], selectionGroups: [], extras: [], includedItems: [], overrides: [], versionStamp: 'v1',
        }),
      });
    }

    if (pathname.endsWith('/shifts/current') && method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'shift-1', openedAtUtc: '2026-01-01T00:00:00Z', openedByUserId: 'u1', openedByEmail: 'cashier@example.com', openingCashAmount: 0, closedAtUtc: null, closedByUserId: null, closedByEmail: null, closingCashAmount: null, openNotes: null, closeNotes: null }) });
    }

    if (pathname.endsWith('/sales') && method === 'POST') {
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          title: 'Conflict',
          status: 409,
          extensions: { reason: 'OutOfStock', itemType: 'Product', itemId: 'product-1', itemName: 'Latte', availableQty: 1 },
        }),
      });
    }

    if (pathname.endsWith('/shifts/close-preview') && method === 'POST') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ shiftId: 'shift-1', openedAtUtc: '2026-01-01T00:00:00Z', openingCashAmount: 0, salesCashTotal: 0, expectedCashAmount: 0 }) });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/app/pos/caja');
  await page.getByTestId('product-card-product-1').click();
  await page.getByTestId('open-payment').click();
  await page.getByTestId('payment-submit').click();

  await expect(page.getByTestId('outofstock-alert')).toBeVisible();
  await expect(page.getByTestId('outofstock-item-name')).toBeVisible();
  await expect(page.getByTestId('outofstock-available-qty')).toBeVisible();
});
