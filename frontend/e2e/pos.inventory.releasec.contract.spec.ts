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

test('store overrides UI can disable and clear explicit override by store', async ({ page }) => {
  const putPayloads: unknown[] = [];
  const deleteUrls: string[] = [];

  await page.route('**/api/v1/pos/**', async (route) => {
    const request = route.request();
    const { pathname, searchParams } = new URL(request.url());

    if (pathname.endsWith('/admin/products') && request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'product-1', name: 'Latte', externalCode: 'LAT-1', categoryId: 'c1', subcategoryName: null, basePrice: 10, isActive: true, isAvailable: true, customizationSchemaId: null }]) });
    }

    if (pathname.endsWith('/admin/extras') && request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'extra-1', name: 'Shot', price: 2, isActive: true, isAvailable: true }]) });
    }

    if (pathname.endsWith('/admin/option-sets') && request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'set-1', name: 'Leches', isActive: true }]) });
    }

    if (pathname.endsWith('/admin/option-sets/set-1/items') && request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'option-1', optionSetId: 'set-1', name: 'Avena', isActive: true, isAvailable: true, sortOrder: 1 }]) });
    }

    if (pathname.endsWith('/admin/catalog/store-overrides') && request.method() === 'GET') {
      if (searchParams.get('storeId') === 'store-e2e') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ storeId: 'store-e2e', itemType: 'Product', itemId: 'product-1', state: 'Enabled', updatedAtUtc: '2026-01-01T00:00:00Z' }]) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    }

    if (pathname.endsWith('/admin/catalog/store-overrides') && request.method() === 'PUT') {
      putPayloads.push(request.postDataJSON());
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(request.postDataJSON()) });
    }

    if (pathname.endsWith('/admin/catalog/store-overrides') && request.method() === 'DELETE') {
      deleteUrls.push(request.url());
      return route.fulfill({ status: 204, body: '' });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/app/admin/pos/overrides');
  await page.getByTestId('store-override-store-select').fill('store-e2e');
  await page.getByRole('button', { name: 'Cargar' }).click();

  await expect(page.getByTestId('store-override-state-Product-product-1')).toContainText('Enabled');
  await page.getByTestId('store-override-disable-Product-product-1').click();
  await expect(page.getByTestId('store-override-state-Product-product-1')).toContainText('Disabled');

  await page.getByTestId('store-override-clear-Product-product-1').click();
  await expect(page.getByTestId('store-override-state-Product-product-1')).toContainText('Sin override');

  expect(putPayloads[0]).toEqual({ storeId: 'store-e2e', itemType: 'Product', itemId: 'product-1', state: 'Disabled' });
  expect(deleteUrls[0]).toContain('storeId=store-e2e');
  expect(deleteUrls[0]).toContain('itemType=Product');
});

test('inventory lite UI updates stock for products and extras using release C endpoint', async ({ page }) => {
  const inventoryPuts: unknown[] = [];

  await page.route('**/api/v1/pos/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());

    if (pathname.endsWith('/admin/catalog/inventory') && request.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { storeId: 'store-e2e', itemType: 'Product', itemId: 'product-1', itemName: 'Latte', itemSku: 'LAT-1', isInventoryTracked: true, onHandQty: 1, updatedAtUtc: '2026-01-01T00:00:00Z' },
          { storeId: 'store-e2e', itemType: 'Extra', itemId: 'extra-1', itemName: 'Shot', itemSku: 'SH-1', isInventoryTracked: true, onHandQty: 2, updatedAtUtc: '2026-01-01T00:00:00Z' },
          { storeId: 'store-e2e', itemType: 'OptionItem', itemId: 'opt-1', itemName: 'Hielo', onHandQty: 7, updatedAtUtc: '2026-01-01T00:00:00Z' },
        ]),
      });
    }

    if (pathname.endsWith('/admin/catalog/inventory') && request.method() === 'PUT') {
      inventoryPuts.push(request.postDataJSON());
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/app/admin/pos/inventory');
  await page.getByTestId('inventory-store-select').fill('store-e2e');
  await page.getByRole('button', { name: 'Cargar' }).click();

  await expect(page.getByTestId('inventory-row-Product-product-1')).toBeVisible();
  await expect(page.getByTestId('inventory-row-Extra-extra-1')).toBeVisible();
  await expect(page.getByTestId('inventory-row-OptionItem-opt-1')).toHaveCount(0);

  await page.getByTestId('inventory-stock-input-Product-product-1').fill('9');
  await page.getByTestId('inventory-save-Product-product-1').click();
  await page.getByTestId('inventory-stock-input-Extra-extra-1').fill('6');
  await page.getByTestId('inventory-save-Extra-extra-1').click();

  expect(inventoryPuts).toEqual([
    { storeId: 'store-e2e', itemType: 'Product', itemId: 'product-1', onHandQty: 9 },
    { storeId: 'store-e2e', itemType: 'Extra', itemId: 'extra-1', onHandQty: 6 },
  ]);
});

test('pos badge contract shows disabled reasons and disabled controls', async ({ page }) => {
  await page.route('**/api/v1/pos/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());

    if (pathname.endsWith('/catalog/snapshot') && request.method() === 'GET') {
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
          products: [
            { id: 'product-store-disabled', externalCode: null, name: 'Latte', categoryId: 'cat-1', subcategoryName: null, basePrice: 10, isActive: true, isAvailable: false, customizationSchemaId: null, availabilityReason: 'DisabledByStore' },
            { id: 'product-out-stock', externalCode: null, name: 'Mocha', categoryId: 'cat-1', subcategoryName: null, basePrice: 10, isActive: true, isAvailable: false, customizationSchemaId: null, availabilityReason: 'OutOfStock' },
          ],
          optionSets: [], optionItems: [], schemas: [], selectionGroups: [], extras: [], includedItems: [], overrides: [], versionStamp: 'v1',
        }),
      });
    }

    if (pathname.endsWith('/shifts/current') && request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'shift-1', openedAtUtc: '2026-01-01T00:00:00Z', openedByUserId: 'u1', openedByEmail: 'cashier@example.com', openingCashAmount: 0, closedAtUtc: null, closedByUserId: null, closedByEmail: null, closingCashAmount: null, openNotes: null, closeNotes: null }) });
    }

    if (pathname.endsWith('/shifts/close-preview') && request.method() === 'POST') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ shiftId: 'shift-1', openedAtUtc: '2026-01-01T00:00:00Z', openingCashAmount: 0, salesCashTotal: 0, expectedCashAmount: 0 }) });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/app/pos/caja');

  await expect(page.getByTestId('availability-badge-Product-product-store-disabled')).toContainText('DisabledByStore');
  await expect(page.getByTestId('availability-badge-Product-product-out-stock')).toContainText('OutOfStock');
  await expect(page.getByTestId('product-product-store-disabled')).toBeDisabled();
  await expect(page.getByTestId('product-product-out-stock')).toBeDisabled();
});
