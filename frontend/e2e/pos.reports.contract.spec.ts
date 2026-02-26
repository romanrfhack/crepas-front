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

test('POS reports UI-contract renders sections and propagates selected filters', async ({
  page,
}) => {
  const seenUrls: string[] = [];
  const hasReportsPath = (url: string, endpoint: string) =>
    new URL(url).pathname.includes(endpoint);

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

    if (url.pathname.endsWith('/reports/sales/categories')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          dateFrom: '2026-03-01',
          dateTo: '2026-03-07',
          items: [
            {
              categoryId: 'cat-hot-drinks',
              categoryName: 'Bebidas calientes',
              quantity: 2,
              grossSales: 220,
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
          dateFrom: '2026-03-01',
          dateTo: '2026-03-07',
          top: 20,
          items: [
            {
              productId: 'p1',
              productName: 'Latte',
              quantity: 2,
              grossSales: 220,
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
          dateFrom: '2026-03-01',
          dateTo: '2026-03-07',
          top: 20,
          items: [
            {
              extraId: 'extra-1',
              extraName: 'Shot extra',
              quantity: 1,
              grossSales: 20,
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
          dateFrom: '2026-03-01',
          dateTo: '2026-03-07',
          top: 20,
          items: [
            {
              optionItemId: 'option-1',
              optionItemName: 'Leche deslactosada',
              usageCount: 1,
              grossImpact: 10,
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
          dateFrom: '2026-03-01',
          dateTo: '2026-03-07',
          shifts: [
            {
              shiftId: 'shift-e2e',
              businessDate: '2026-03-07',
              cashierUserId: 'cashier-e2e',
              expectedCash: 100,
              countedCash: 100,
              difference: 0,
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
  const cashiersLoaded = page.waitForResponse(
    (response) =>
      hasReportsPath(response.url(), '/reports/sales/cashiers') &&
      response.request().method() === 'GET',
  );
  const shiftsLoaded = page.waitForResponse(
    (response) =>
      hasReportsPath(response.url(), '/reports/shifts/summary') &&
      response.request().method() === 'GET',
  );
  await page.goto('/app/pos/reportes');
  await Promise.all([cashiersLoaded, shiftsLoaded]);

  await expect(page.getByTestId('reports-payments-table')).toBeVisible();
  await expect(page.getByTestId('reports-hourly-table')).toBeVisible();
  await expect(page.getByTestId('reports-top-products-table')).toBeVisible();
  await expect(page.getByTestId('reports-void-reasons-table')).toBeVisible();
  await expect(
    page.locator('[data-testid="reports-cashier"] option[value="cashier-e2e"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('[data-testid="reports-shift"] option[value="shift-e2e"]'),
  ).toHaveCount(1, { timeout: 15000 });

  await page.getByTestId('reports-cashier').selectOption('cashier-e2e');
  await page.getByTestId('reports-shift').selectOption('shift-e2e');
  await page.getByTestId('reports-refresh').click();

  await expect
    .poll(() =>
      seenUrls.some(
        (item) =>
          item.includes('/reports/sales/daily') &&
          item.includes('cashierUserId=cashier-e2e') &&
          item.includes('shiftId=shift-e2e'),
      ),
    )
    .toBeTruthy();
});
