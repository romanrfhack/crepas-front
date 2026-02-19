import { expect, Page, test } from '@playwright/test';

type Role = 'Cashier' | 'Manager';

interface FakeSale {
  saleId: string;
  folio: string;
  status: 'Completed' | 'Void';
  payments: Array<{ method: string; amount: number; reference?: string | null }>;
  total: number;
}

interface FakeServerOptions {
  role?: Role;
  voidFirstAttemptForbidden?: boolean;
  unavailableProductOnSnapshot?: boolean;
  staleUnavailableOnCreateSale?: boolean;
}

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const buildJwt = (role: Role) => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'e2e-user',
      email: 'cashier@example.com',
      roles: [role],
      exp: 4102444800,
    }),
  ).toString('base64url');
  return `${header}.${payload}.sig`;
};

const seedAuth = async (page: Page, role: Role) => {
  const token = buildJwt(role);
  await page.addInitScript((accessToken: string) => {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', 'refresh-token-e2e');
    localStorage.removeItem('pos_active_store_id');
  }, token);
};

const setupFakePosApi = async (page: Page, options: FakeServerOptions = {}) => {
  const shiftId = 'SHIFT-E2E-1';
  let shiftOpen = false;
  let voidAttempts = 0;
  let snapshotCalls = 0;
  let createSaleCalls = 0;
  const sales: FakeSale[] = [];

  const captured = {
    saleRequests: [] as Record<string, unknown>[],
    closePreviewRequests: [] as Array<{ method: string; body: Record<string, unknown> }>,
    closeRequests: [] as Record<string, unknown>[],
    voidRequests: [] as Record<string, unknown>[],
    snapshotCalls: () => snapshotCalls,
    createSaleCalls: () => createSaleCalls,
  };

  await page.route('**/api/v1/pos/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;
    const method = request.method();

    const body =
      method === 'POST' || method === 'PUT' || method === 'PATCH'
        ? ((request.postDataJSON() as Record<string, unknown> | null) ?? {})
        : {};

    if (pathname.endsWith('/catalog/snapshot') && method === 'GET') {
      snapshotCalls += 1;
      const unavailableByConfig = options.unavailableProductOnSnapshot;
      const unavailableAfterRefresh = options.staleUnavailableOnCreateSale && snapshotCalls > 1;
      const productAvailable = !(unavailableByConfig || unavailableAfterRefresh);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { ETag: `"snapshot-${snapshotCalls}"` },
        body: JSON.stringify({
          storeId: 'store-e2e',
          timeZoneId: 'America/Mexico_City',
          generatedAtUtc: '2026-01-01T08:00:00Z',
          catalogVersion: `v${snapshotCalls}`,
          etagSeed: `seed-${snapshotCalls}`,
          categories: [{ id: 'C1', name: 'Bebidas', sortOrder: 1, isActive: true }],
          products: [
            {
              id: 'P1',
              externalCode: null,
              name: 'Café americano',
              categoryId: 'C1',
              subcategoryName: null,
              basePrice: 120,
              isActive: true,
              isAvailable: productAvailable,
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
          versionStamp: 'e2e-v1',
        }),
      });
    }

    if (pathname.endsWith('/shifts/current') && method === 'GET') {
      if (!shiftOpen) {
        return route.fulfill({ status: 204, body: '' });
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: shiftId,
          openedAtUtc: '2026-01-01T08:00:00Z',
          openedByUserId: 'cashier-1',
          openedByEmail: 'cashier@example.com',
          openingCashAmount: 100,
          closedAtUtc: null,
          closedByUserId: null,
          closedByEmail: null,
          closingCashAmount: null,
          expectedClosingAmount: null,
          openNotes: null,
          closeNotes: null,
        }),
      });
    }

    if (pathname.endsWith('/shifts/open') && method === 'POST') {
      shiftOpen = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: shiftId,
          openedAtUtc: '2026-01-01T08:00:00Z',
          openedByUserId: 'cashier-1',
          openedByEmail: 'cashier@example.com',
          openingCashAmount: Number(body.startingCashAmount ?? 0),
          closedAtUtc: null,
          closedByUserId: null,
          closedByEmail: null,
          closingCashAmount: null,
          expectedClosingAmount: null,
          openNotes: null,
          closeNotes: null,
        }),
      });
    }

    if (pathname.endsWith('/sales') && method === 'POST') {
      createSaleCalls += 1;
      if (options.staleUnavailableOnCreateSale && createSaleCalls === 1) {
        console.log('[Fake API] Returning 409 ITEM_UNAVAILABLE');
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'ITEM_UNAVAILABLE',
            title: 'ItemUnavailable',
            detail: 'Producto no disponible en catálogo actual',
            status: 409,
            itemType: 'Product',
            itemId: 'P1',
            extensions: {
              itemType: 'Product',
              itemId: 'P1',
              itemName: 'Café americano',
            },
          }),
        });
      }

      captured.saleRequests.push(body);
      const payments = (body.payments as FakeSale['payments']) ?? [];
      const saleId = `S${sales.length + 1}`;
      const total = payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
      sales.unshift({ saleId, folio: `FOL-${saleId}`, status: 'Completed', payments, total });

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          saleId,
          folio: `FOL-${saleId}`,
          occurredAtUtc: '2026-01-01T09:00:00Z',
          total,
        }),
      });
    }

    if (pathname.endsWith('/shifts/close-preview') && method === 'POST') {
      captured.closePreviewRequests.push({ method, body });
      const cashCount =
        (body.cashCount as Array<{ denominationValue: number; count: number }>) ?? [];
      const countedCashAmount = cashCount.reduce(
        (sum, line) => sum + Number(line.denominationValue) * Number(line.count),
        0,
      );
      const hasCashCount = cashCount.length > 0;

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          shiftId,
          openedAtUtc: '2026-01-01T08:00:00Z',
          openingCashAmount: 100,
          salesCashTotal: 20,
          expectedCashAmount: 20,
          countedCashAmount: hasCashCount ? countedCashAmount : null,
          difference: hasCashCount ? countedCashAmount - 20 : null,
          lastCashCount: hasCashCount ? countedCashAmount : null,
          breakdown: {
            cashAmount: 20,
            cardAmount: 100,
            transferAmount: 0,
            totalSalesCount: 1,
          },
        }),
      });
    }

    if (pathname.endsWith('/shifts/close') && method === 'POST') {
      captured.closeRequests.push(body);
      const counted = (
        (body.countedDenominations as Array<{ denominationValue: number; count: number }>) ?? []
      ).reduce((sum, line) => sum + Number(line.denominationValue) * Number(line.count), 0);
      const difference = counted - 20;
      const reason = String(body.closeReason ?? '').trim();

      if (Math.abs(difference) >= 20 && !reason) {
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'DIFFERENCE_REASON_REQUIRED' }),
        });
      }

      shiftOpen = false;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          shiftId,
          openedAtUtc: '2026-01-01T08:00:00Z',
          closedAtUtc: '2026-01-01T10:00:00Z',
          openingCashAmount: 100,
          salesCashTotal: 20,
          expectedCashAmount: 20,
          countedCashAmount: counted,
          difference,
          closeNotes: body.closingNotes ?? null,
          closeReason: body.closeReason ?? null,
        }),
      });
    }

    const voidMatch = pathname.match(/\/(?:api\/)?v1\/pos\/sales\/([^/]+)\/void$/);
    if (voidMatch && method === 'POST') {
      captured.voidRequests.push(body);
      voidAttempts += 1;
      const saleId = voidMatch[1] ?? '';
      const sale = sales.find((current) => current.saleId === saleId);

      if (!sale) {
        return route.fulfill({ status: 404, body: '' });
      }

      const isForbidden = options.voidFirstAttemptForbidden && voidAttempts === 1;
      if (isForbidden && options.role !== 'Manager') {
        return route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'FORBIDDEN_VOID' }),
        });
      }

      sale.status = 'Void';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          saleId,
          status: 'Void',
          voidedAtUtc: '2026-01-01T10:10:00Z',
        }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });

  return captured;
};

const openPosCaja = async (page: Page) => {
  await page.goto('/app/pos/caja');
  await expect(page.getByPlaceholder('Buscar producto...')).toBeVisible();
};

const ensureShiftOpen = async (page: Page) => {
  const openShiftButton = page.getByTestId('open-shift');
  const openShiftModal = page.getByTestId('open-shift-modal');
  const confirmOpenShiftButton = page.getByTestId('confirm-open-shift');

  if (!(await openShiftModal.isVisible()) && (await openShiftButton.isVisible())) {
    await openShiftButton.click();
    await expect(openShiftModal).toBeVisible();
  }

  if (await openShiftModal.isVisible()) {
    await expect(confirmOpenShiftButton).toBeVisible();
    await confirmOpenShiftButton.click();
    await expect(openShiftModal).toBeHidden();
  }
};

const addSingleProductToCart = async (page: Page) => {
  await page.getByRole('button', { name: /Agregar Café americano al carrito/i }).click();
  await page.getByTestId('open-payment').click();
};

const submitMixedPayment = async (page: Page) => {
  await page.getByTestId('payment-amount-0').fill('20');
  await page.getByTestId('add-payment').click();
  await page.getByTestId('payment-method-1').selectOption('Card');
  await page.getByTestId('payment-amount-1').fill('100');
  await page.getByTestId('payment-ref-1').fill('AUTH-123');
  await page.getByTestId('confirm-payment').click();
};

test('A) Mixed payments envía payments[] en POST /pos/sales', async ({ page }) => {
  const captured = await setupFakePosApi(page, { role: 'Cashier' });
  await seedAuth(page, 'Cashier');
  await openPosCaja(page);
  await ensureShiftOpen(page);

  await addSingleProductToCart(page);
  await submitMixedPayment(page);

  expect(captured.saleRequests).toHaveLength(1);
  const [requestBody] = captured.saleRequests;
  expect(requestBody.payments).toEqual([
    { method: 'Cash', amount: 20, reference: null },
    { method: 'Card', amount: 100, reference: 'AUTH-123' },
  ]);
  expect(requestBody.payment).toBeFalsy();
});

test('B) Close-preview v2 usa POST y el segundo request incluye cashCount', async ({ page }) => {
  const captured = await setupFakePosApi(page, { role: 'Cashier' });
  await seedAuth(page, 'Cashier');
  await openPosCaja(page);
  await ensureShiftOpen(page);
  await addSingleProductToCart(page);
  await submitMixedPayment(page);

  await page.getByTestId('open-close-shift').click();
  await expect(page.getByText('Cierre de turno')).toBeVisible();

  await page.locator('#denomination-count-0').fill('0');
  await page.locator('#denomination-count-5').fill('1');
  await page.locator('#denomination-count-5').dispatchEvent('change');

  expect(captured.closePreviewRequests.length).toBeGreaterThanOrEqual(2);
  expect(captured.closePreviewRequests[0]?.method).toBe('POST');
  expect(captured.closePreviewRequests[1]?.body.cashCount).toEqual([
    { denominationValue: 20, count: 1 },
  ]);
});

test('C) Close shift exige closeReason con diferencia grande y envía clientOperationId', async ({
  page,
}) => {
  const captured = await setupFakePosApi(page, { role: 'Cashier' });
  await seedAuth(page, 'Cashier');
  await openPosCaja(page);
  await ensureShiftOpen(page);
  await addSingleProductToCart(page);
  await submitMixedPayment(page);

  await page.getByTestId('open-close-shift').click();
  await page.locator('#denomination-count-4').fill('1');
  await page.locator('#denomination-count-4').dispatchEvent('change');

  await page.getByTestId('confirm-close-shift').click();
  await expect(page.getByTestId('close-error')).toBeVisible();

  await page.getByTestId('close-reason').fill('Sobrante detectado por redondeo operativo');
  await page.getByTestId('confirm-close-shift').click();
  await expect(page.getByText('Cierre registrado')).toBeVisible();

  expect(captured.closeRequests.length).toBeGreaterThanOrEqual(1);
  const successfulRequest = captured.closeRequests.at(-1) as Record<string, unknown>;
  expect(successfulRequest.countedDenominations).toEqual([{ denominationValue: 50, count: 1 }]);
  expect(String(successfulRequest.clientOperationId ?? '')).toMatch(uuidRegex);
  expect(successfulRequest.closeReason).toBe('Sobrante detectado por redondeo operativo');
});

test('D) Producto no disponible se renderiza disabled con badge Agotado', async ({ page }) => {
  await setupFakePosApi(page, { role: 'Cashier', unavailableProductOnSnapshot: true });
  await seedAuth(page, 'Cashier');
  await openPosCaja(page);

  const productButton = page.getByTestId('product-P1');
  await expect(productButton).toBeDisabled();
  await expect(page.getByTestId('product-unavailable-P1')).toBeVisible();
});

test('E) Cache stale: create sale 409 unavailable y actualización de catálogo refresca estado', async ({
  page,
}) => {
  page.on('console', (msg) => console.log('BROWSER LOG:', msg.text()));

  const captured = await setupFakePosApi(page, {
    role: 'Cashier',
    staleUnavailableOnCreateSale: true,
  });
  await seedAuth(page, 'Cashier');

  await page.addInitScript(() => {
    localStorage.setItem(
      'pos_catalog_snapshot_cache:default',
      JSON.stringify({
        etag: '"snapshot-stale"',
        snapshot: {
          storeId: 'store-e2e',
          timeZoneId: 'America/Mexico_City',
          generatedAtUtc: '2026-01-01T07:00:00Z',
          catalogVersion: 'stale-v0',
          etagSeed: 'stale-seed',
          categories: [{ id: 'C1', name: 'Bebidas', sortOrder: 1, isActive: true }],
          products: [
            {
              id: 'P1',
              externalCode: null,
              name: 'Café americano',
              categoryId: 'C1',
              subcategoryName: null,
              basePrice: 120,
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
          versionStamp: 'stale-v0',
        },
      }),
    );
  });

  await openPosCaja(page);
  await ensureShiftOpen(page);

  await addSingleProductToCart(page);
  const createSaleConflict = page.waitForResponse(
    (response) => response.url().includes('/api/v1/pos/sales') && response.status() === 409,
  );
  await submitMixedPayment(page);
  await createSaleConflict;

  await expect(page.getByTestId('unavailable-alert')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('refresh-catalog-unavailable')).toBeVisible();
  await expect(page.getByTestId('unavailable-item-name')).toBeVisible();
  await expect(page.getByTestId('unavailable-item-name')).toHaveText(/Cafe|Café/i);

  const callsBeforeRefresh = captured.snapshotCalls();
  await page.getByTestId('refresh-catalog-unavailable').click();
  await expect(page.getByTestId('product-P1')).toBeDisabled();
  await expect(page.getByTestId('product-unavailable-P1')).toBeVisible();
  expect(captured.snapshotCalls()).toBeGreaterThan(callsBeforeRefresh);
  expect(captured.createSaleCalls()).toBe(1);
});
