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

test('crear ajuste ok muestra success y refresca historial', async ({ page }) => {
  let adjustmentCreated = false;

  await page.route('**/v1/pos/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());

    if (pathname.includes('/admin/products')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'product-1',
            name: 'Latte',
            externalCode: 'LAT',
            categoryId: 'c1',
            subcategoryName: null,
            basePrice: 1,
            isActive: true,
            isAvailable: true,
            customizationSchemaId: null,
          },
        ]),
      });
    }

    if (pathname.includes('/admin/extras')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'extra-1', name: 'Shot', price: 1, isActive: true, isAvailable: true },
        ]),
      });
    }

    if (pathname.includes('/admin/catalog/inventory/adjustments') && request.method() === 'GET') {
      const rows = adjustmentCreated
        ? [
            {
              id: 'adj-2',
              storeId: 'store-e2e',
              itemType: 'Product',
              itemId: 'product-1',
              itemName: 'Latte',
              qtyBefore: 3,
              qtyDelta: 2,
              qtyAfter: 5,
              reason: 'Purchase',
              note: '',
              createdAtUtc: '2026-01-01T00:00:01Z',
              performedByUserId: 'admin',
            },
          ]
        : [];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(rows),
      });
    }

    if (pathname.includes('/admin/catalog/inventory') && request.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            storeId: 'store-e2e',
            itemType: 'Product',
            itemId: 'product-1',
            itemName: 'Latte',
            onHandQty: 3,
            updatedAtUtc: '2026-01-01T00:00:00Z',
            isInventoryTracked: true,
          },
        ]),
      });
    }

    if (pathname.includes('/admin/catalog/inventory/adjustments') && request.method() === 'POST') {
      adjustmentCreated = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'adj-2' }),
      });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/app/admin/pos/inventory');
  await page.getByTestId('inventory-store-select').fill('store-e2e');
  await page.getByRole('button', { name: 'Cargar' }).click();
  await page.getByTestId('inventory-adjust-store').fill('store-e2e');
  await expect(
    page.getByTestId('inventory-adjust-item').locator('option[value="product-1"]'),
  ).toHaveCount(1);
  await page.getByTestId('inventory-adjust-item').selectOption('product-1');
  await expect(page.getByTestId('inventory-adjust-item')).toHaveValue('product-1');
  await page.getByTestId('inventory-adjust-reason').selectOption('Correction');
  await page.getByTestId('inventory-adjust-delta').fill('2');
  await page.getByTestId('inventory-adjust-delta').blur();
  await expect(page.getByTestId('inventory-adjust-submit')).toBeEnabled();
  await page.getByTestId('inventory-adjust-submit').click({ force: true });
  await expect(page.getByTestId('inventory-adjust-success')).toBeVisible();
  await expect(page.locator('[data-testid^="inventory-history-row-"]').first()).toBeVisible();
  await expect(page.getByTestId('inventory-adjust-error')).toHaveCount(0);
});

test('crear ajuste 409 muestra reason code estable', async ({ page }) => {
  await page.route('**/v1/pos/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (pathname.includes('/admin/products')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'product-1',
            name: 'Latte',
            externalCode: 'LAT',
            categoryId: 'c1',
            subcategoryName: null,
            basePrice: 1,
            isActive: true,
            isAvailable: true,
            customizationSchemaId: null,
          },
        ]),
      });
    }
    if (pathname.includes('/admin/extras')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }
    if (
      pathname.includes('/admin/catalog/inventory') ||
      pathname.includes('/admin/catalog/inventory/adjustments')
    ) {
      if (request.method() === 'POST') {
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ reason: 'NegativeStockNotAllowed' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/app/admin/pos/inventory');
  await page.getByTestId('inventory-store-select').fill('store-e2e');
  await page.getByRole('button', { name: 'Cargar' }).click();
  await page.getByTestId('inventory-adjust-store').fill('store-e2e');
  await expect(
    page.getByTestId('inventory-adjust-item').locator('option[value="product-1"]'),
  ).toHaveCount(1);
  await page.getByTestId('inventory-adjust-item').selectOption('product-1');
  await expect(page.getByTestId('inventory-adjust-item')).toHaveValue('product-1');
  await page.getByTestId('inventory-adjust-reason').selectOption('Correction');
  await expect(page.getByTestId('inventory-adjust-reason')).toHaveValue('Correction');
  await page.getByTestId('inventory-adjust-delta').fill('-5');
  await page.getByTestId('inventory-adjust-delta').blur();
  await expect(page.getByTestId('inventory-adjust-submit')).toBeEnabled();
  await page.getByTestId('inventory-adjust-submit').click({ force: true });
  await expect(page.getByTestId('inventory-adjust-error')).toHaveText('NegativeStockNotAllowed');
  await expect(page.getByTestId('inventory-adjust-success')).toHaveCount(0);
});

test('reportes inventory current/low/out renderizan y propagan filtros', async ({ page }) => {
  const urls: string[] = [];
  await page.route('**/v1/pos/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    urls.push(request.url());

    if (pathname.includes('/reports/inventory/') && request.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            itemType: 'Product',
            itemId: 'product-1',
            itemName: 'Latte',
            itemSku: 'LAT',
            storeId: 'store-e2e',
            stockOnHandQty: 1,
            isInventoryTracked: true,
            availabilityReason: null,
            storeOverrideState: null,
            updatedAtUtc: null,
            lastAdjustmentAtUtc: null,
          },
        ]),
      });
    }

    if (pathname.endsWith('/reports/sales/cashiers')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ cashierUserId: 'cashier-e2e', tickets: 1, totalSales: 10 }]),
      });
    }

    if (pathname.endsWith('/reports/shifts/summary')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ shiftId: 'shift-e2e', cashierUserId: 'cashier-e2e' }]),
      });
    }

    if (
      pathname.endsWith('/reports/sales/daily') ||
      pathname.endsWith('/reports/sales/hourly') ||
      pathname.endsWith('/reports/top-products') ||
      pathname.endsWith('/reports/voids/reasons')
    ) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    if (pathname.endsWith('/reports/payments/methods')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ dateFrom: '2026-01-01', dateTo: '2026-01-01', totals: [] }),
      });
    }

    if (
      pathname.endsWith('/reports/sales/categories') ||
      pathname.endsWith('/reports/sales/products') ||
      pathname.endsWith('/reports/sales/addons/extras') ||
      pathname.endsWith('/reports/sales/addons/options')
    ) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
    }

    if (pathname.endsWith('/reports/control/cash-differences')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ daily: [], shifts: [] }),
      });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/app/pos/reportes');
  await page.getByTestId('report-inventory-filter-store').fill('store-e2e');
  await page.getByTestId('report-inventory-filter-search').fill('latte');
  await page.getByTestId('report-inventory-filter-threshold').fill('3');

  const inventoryCurrentResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/reports/inventory/current') &&
      response.request().method() === 'GET',
  );
  const inventoryLowResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/reports/inventory/low-stock') &&
      response.request().method() === 'GET',
  );
  const inventoryOutResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/reports/inventory/out-of-stock') &&
      response.request().method() === 'GET',
  );
  await page.getByTestId('reports-refresh').click();
  await Promise.all([inventoryCurrentResponse, inventoryLowResponse, inventoryOutResponse]);

  await expect(page.getByTestId('report-inventory-current')).toBeVisible();
  await expect(page.getByTestId('report-inventory-low')).toBeVisible();
  await expect(page.getByTestId('report-inventory-out')).toBeVisible();

  expect(
    urls.some((url) => url.includes('/inventory/low-stock') && url.includes('threshold=3')),
  ).toBeTruthy();
  await expect(page.locator('[data-testid^="report-inventory-current-row-"]').first()).toBeVisible({
    timeout: 15000,
  });
  await expect(page.locator('[data-testid^="report-inventory-low-row-"]').first()).toBeVisible({
    timeout: 15000,
  });
  await expect(page.locator('[data-testid^="report-inventory-out-row-"]').first()).toBeVisible({
    timeout: 15000,
  });
});

test('historial C.2.1 renderiza movementKind, referencia y fallback estable', async ({ page }) => {
  await page.route('**/v1/pos/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());

    if (pathname.includes('/admin/products')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'product-1',
            name: 'Latte',
            externalCode: 'LAT',
            categoryId: 'c1',
            subcategoryName: null,
            basePrice: 1,
            isActive: true,
            isAvailable: true,
            customizationSchemaId: null,
          },
        ]),
      });
    }

    if (pathname.includes('/admin/extras')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    if (pathname.includes('/admin/catalog/inventory/adjustments') && request.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'adj-manual',
            storeId: 'store-e2e',
            itemType: 'Product',
            itemId: 'product-1',
            itemName: 'Latte',
            qtyBefore: 5,
            qtyDelta: 1,
            qtyAfter: 6,
            reason: 'Correction',
            movementKind: null,
            referenceType: null,
            referenceId: null,
            createdAtUtc: '2026-01-01T00:00:00Z',
            performedByUserId: 'admin',
          },
          {
            id: 'adj-sale',
            storeId: 'store-e2e',
            itemType: 'Product',
            itemId: 'product-1',
            itemName: 'Latte',
            qtyBefore: 6,
            qtyDelta: -1,
            qtyAfter: 5,
            reason: 'ManualCount',
            movementKind: 'SaleConsumption',
            referenceType: 'Sale',
            referenceId: 'sale-100',
            createdAtUtc: '2026-01-01T00:00:01Z',
            performedByUserId: 'admin',
          },
          {
            id: 'adj-void',
            storeId: 'store-e2e',
            itemType: 'Product',
            itemId: 'product-1',
            itemName: 'Latte',
            qtyBefore: 5,
            qtyDelta: 1,
            qtyAfter: 6,
            reason: 'Correction',
            movementKind: 'VoidReversal',
            referenceType: 'SaleVoid',
            referenceId: 'void-200',
            createdAtUtc: '2026-01-01T00:00:02Z',
            performedByUserId: 'admin',
          },
          {
            id: 'adj-unknown',
            storeId: 'store-e2e',
            itemType: 'Product',
            itemId: 'product-1',
            itemName: 'Latte',
            qtyBefore: 6,
            qtyDelta: 0,
            qtyAfter: 6,
            reason: 'FutureReason',
            movementKind: 'FutureMovement',
            createdAtUtc: '2026-01-01T00:00:03Z',
            performedByUserId: 'admin',
          },
        ]),
      });
    }

    if (pathname.includes('/admin/catalog/inventory') && request.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            storeId: 'store-e2e',
            itemType: 'Product',
            itemId: 'product-1',
            itemName: 'Latte',
            onHandQty: 3,
            updatedAtUtc: '2026-01-01T00:00:00Z',
            isInventoryTracked: true,
          },
        ]),
      });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/app/admin/pos/inventory');
  await page.getByTestId('inventory-store-select').fill('store-e2e');
  await page.getByRole('button', { name: 'Cargar' }).click();
  await page.getByTestId('inventory-history-filter-submit').click();

  await expect(page.getByTestId('inventory-history-row-adj-manual')).toBeVisible();
  await expect(page.getByTestId('inventory-history-row-adj-sale')).toBeVisible();
  await expect(page.getByTestId('inventory-history-row-adj-void')).toBeVisible();
  await expect(page.getByTestId('inventory-history-row-adj-unknown')).toBeVisible();

  await expect(page.getByTestId('inventory-history-movement-kind-adj-manual')).toContainText(
    'Corrección',
  );
  await expect(page.getByTestId('inventory-history-movement-kind-adj-sale')).toContainText(
    'Consumo por venta',
  );
  await expect(page.getByTestId('inventory-history-movement-kind-adj-void')).toContainText(
    'Reversa por cancelación',
  );
  await expect(page.getByTestId('inventory-history-movement-kind-adj-unknown')).toContainText(
    'Otro (FutureMovement)',
  );

  await expect(page.getByTestId('inventory-history-reference-adj-sale')).toContainText(
    'Sale: sale-100',
  );
  await expect(page.getByTestId('inventory-history-reference-adj-void')).toContainText(
    'SaleVoid: void-200',
  );
  await expect(page.getByTestId('inventory-history-reference-adj-manual')).toContainText('—');

  await expect(page.getByTestId('inventory-history-badge-sale-consumption')).toBeVisible();
  await expect(page.getByTestId('inventory-history-badge-void-reversal')).toBeVisible();
  await expect(page.getByTestId('inventory-history-badge-unknown')).toBeVisible();
});
