import { expect, Page, test } from '@playwright/test';

const buildJwt = (role: 'Admin' | 'Manager') => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'reports-user',
      email: 'reports@example.com',
      roles: [role],
      exp: 4102444800,
    }),
  ).toString('base64url');

  return `${header}.${payload}.sig`;
};

const seedAuth = async (page: Page) => {
  const token = buildJwt('Manager');
  await page.addInitScript((accessToken: string) => {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', 'refresh-token-e2e');
    localStorage.setItem('pos_active_store_id', 'store-e2e');
  }, token);
};

test('POS reports v2 UI-contract renders v2 blocks and forwards filters', async ({ page }) => {
  const seenUrls: string[] = [];

  await page.route('**/api/v1/pos/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    seenUrls.push(url.toString());

    if (url.pathname.endsWith('/reports/sales/cashiers')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            cashierUserId: 'cashier-e2e',
            tickets: 2,
            totalSales: 320,
            avgTicket: 160,
            voidsCount: 0,
            voidsTotal: 0,
            payments: { cash: 100, card: 220, transfer: 0 },
          },
        ]),
      });
    }

    if (url.pathname.endsWith('/reports/shifts/summary')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            shiftId: 'shift-e2e',
            cashierUserId: 'cashier-e2e',
            openedAtUtc: '2026-03-07T08:00:00Z',
            closedAtUtc: '2026-03-07T16:00:00Z',
            closeReason: null,
            tickets: 2,
            totalSales: 320,
            payments: { cash: 100, card: 220, transfer: 0 },
            closingExpectedCashAmount: 100,
            closingCountedCashAmount: 100,
            cashDifference: 0,
          },
        ]),
      });
    }

    if (url.pathname.endsWith('/reports/sales/daily')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            businessDate: '2026-03-07',
            tickets: 2,
            subtotal: 320,
            discounts: 0,
            tax: 0,
            totalSales: 320,
            avgTicket: 160,
            voidsCount: 0,
            voidsTotal: 0,
            payments: { cash: 100, card: 220, transfer: 0 },
          },
        ]),
      });
    }

    if (url.pathname.endsWith('/reports/payments/methods')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          dateFrom: '2026-03-01',
          dateTo: '2026-03-07',
          totals: [{ method: 'Card', count: 2, amount: 220 }],
        }),
      });
    }

    if (url.pathname.endsWith('/reports/sales/hourly')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ hour: 9, tickets: 2, totalSales: 320 }]),
      });
    }

    if (url.pathname.endsWith('/reports/voids/reasons')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { reasonCode: 'CashierError', reasonText: 'captura', count: 1, amount: 50 },
        ]),
      });
    }

    if (url.pathname.endsWith('/reports/top-products')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { productId: 'p1', productNameSnapshot: 'Latte', qty: 2, amount: 220 },
        ]),
      });
    }

    if (url.pathname.endsWith('/reports/kpis/summary')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tickets: 22,
          totalItems: 40,
          grossSales: 3120,
          avgTicket: 141.82,
          avgItemsPerTicket: 1.8,
          voidCount: 1,
          voidRate: 0.045,
        }),
      });
    }

    if (url.pathname.endsWith('/reports/sales/categories')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              categoryId: 'cat-1',
              categoryName: 'Bebidas',
              tickets: 6,
              quantity: 10,
              grossSales: 1200,
            },
          ],
        }),
      });
    }

    if (url.pathname.endsWith('/reports/sales/products')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              productId: 'prod-1',
              sku: 'LATTE',
              productName: 'Latte',
              tickets: 5,
              quantity: 8,
              grossSales: 980,
            },
          ],
        }),
      });
    }

    if (url.pathname.endsWith('/reports/sales/addons/extras')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              extraId: 'extra-1',
              extraSku: 'QEX',
              extraName: 'Queso extra',
              quantity: 3,
              grossSales: 60,
            },
          ],
        }),
      });
    }

    if (url.pathname.endsWith('/reports/sales/addons/options')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              optionItemId: 'option-1',
              optionItemSku: 'SALSA',
              optionItemName: 'Salsa especial',
              usageCount: 4,
              grossImpact: 45,
            },
          ],
        }),
      });
    }

    if (url.pathname.endsWith('/reports/control/cash-differences')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          daily: [],
          shifts: [
            {
              shiftId: 'shift-e2e',
              openedAt: '2026-03-07T08:00:00Z',
              closedAt: '2026-03-07T16:00:00Z',
              cashierUserId: 'cashier-e2e',
              cashierUserName: 'Cashier E2E',
              expectedCash: 100,
              countedCash: 95,
              difference: -5,
              closeReason: 'Short',
            },
          ],
        }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });

  await seedAuth(page);
  const categoriesResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/pos/reports/sales/categories')
    && response.request().method() === 'GET',
  );
  const productsResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/pos/reports/sales/products')
    && response.request().method() === 'GET',
  );
  const cashDiffResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/pos/reports/control/cash-differences')
    && response.request().method() === 'GET',
  );
  await page.goto('/app/pos/reportes');
  await Promise.all([categoriesResponse, productsResponse, cashDiffResponse]);

  await expect(page.getByTestId('mix-categories-table')).toBeVisible();
  await expect(page.getByTestId('mix-products-table')).toBeVisible();
  await expect(page.getByTestId('addons-extras-table')).toBeVisible();
  await expect(page.getByTestId('addons-options-table')).toBeVisible();
  await expect(page.getByTestId('cash-diff-table')).toBeVisible();
  await expect(page.getByTestId('mix-category-row-0')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('mix-product-row-0')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-testid^="cash-diff-row-"]').first()).toBeVisible({ timeout: 15000 });

  await expect(page.getByTestId('cash-diff-table').locator('thead')).not.toContainText('Turno');
  await expect(page.locator('[data-testid^="cash-diff-row-"]').first()).toContainText('Cashier E2E');
  await expect(
    page.locator('[data-testid="reports-cashier"] option[value="cashier-e2e"]'),
  ).toHaveCount(1);
  await expect(page.locator('[data-testid="reports-shift"] option[value="shift-e2e"]')).toHaveCount(
    1,
  );

  await page.getByTestId('reports-cashier').selectOption('cashier-e2e');
  await page.getByTestId('reports-shift').selectOption('shift-e2e');
  await page.getByTestId('reports-refresh').click();

  await expect
    .poll(() => {
      const withFilters = seenUrls.filter(
        (item) => item.includes('cashierUserId=cashier-e2e') && item.includes('shiftId=shift-e2e'),
      );
      const cashDiff = seenUrls.filter(
        (item) =>
          item.includes('/reports/control/cash-differences') &&
          item.includes('cashierUserId=cashier-e2e') &&
          !item.includes('shiftId=shift-e2e'),
      );
      return withFilters.length > 0 && cashDiff.length > 0;
    })
    .toBeTruthy();
});
