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
      localStorage.setItem('platform_selected_tenant_id', 'tenant-1');
    },
    buildJwt(['SuperAdmin']),
  );
});

test('tenant details/settings v1 ui-contract', async ({ page }) => {
  let tenantDetails = {
    id: 'tenant-1',
    name: 'Tenant One',
    slug: 'tenant-one',
    verticalId: 'vertical-1',
    verticalName: 'Retail',
    isActive: true,
    defaultStoreId: 'store-1',
    defaultStoreName: 'Store Centro',
    storeCount: 4,
    activeStoreCount: 3,
    hasCatalogTemplate: true,
    catalogTemplateId: 'template-1',
    catalogTemplateName: 'Template Retail',
    usersCount: 12,
    usersWithoutStoreAssignmentCount: 2,
    storesWithoutAdminStoreCount: 1,
    createdAtUtc: '2026-01-01T00:00:00Z',
    updatedAtUtc: '2026-01-02T00:00:00Z',
  };

  await page.route('**/api/v1/platform/verticals**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'vertical-1',
          name: 'Retail',
          description: null,
          isActive: true,
          createdAtUtc: '2026-01-01',
          updatedAtUtc: '2026-01-01',
        },
      ]),
    });
  });

  await page.route('**/api/v1/platform/tenants/tenant-1', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(tenantDetails),
      });
    }

    if (request.method() === 'PUT') {
      const payload = JSON.parse(request.postData() ?? '{}') as {
        name: string;
        slug: string;
        verticalId?: string;
        isActive?: boolean;
      };
      tenantDetails = {
        ...tenantDetails,
        name: payload.name,
        slug: payload.slug,
        isActive: payload.isActive ?? tenantDetails.isActive,
      };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(tenantDetails),
      });
    }

    return route.fulfill({ status: 500, body: '{}' });
  });

  await page.goto('/app/platform/tenants/tenant-1');
  await expect(page.getByTestId('platform-tenant-details-page')).toBeVisible();

  await expect(page.getByTestId('platform-tenant-details-name')).toContainText('Tenant One');
  await expect(page.getByTestId('platform-tenant-details-slug')).toContainText('tenant-one');
  await expect(page.getByTestId('platform-tenant-details-vertical')).toContainText('Retail');
  await expect(page.getByTestId('platform-tenant-details-default-store')).toContainText(
    'Store Centro',
  );
  await expect(page.getByTestId('platform-tenant-details-template')).toContainText(
    'Template Retail',
  );

  await page.getByTestId('platform-tenant-details-action-edit').click();
  await page.getByTestId('platform-tenant-edit-name').fill('Tenant One Updated');
  await page.getByTestId('platform-tenant-edit-slug').fill('tenant-one-updated');
  await page.getByTestId('platform-tenant-edit-active').uncheck();
  await page.getByTestId('platform-tenant-edit-submit').click();

  await expect(page.getByTestId('platform-tenant-edit-success')).toBeVisible();
  await expect(page.getByTestId('platform-tenant-details-name')).toContainText(
    'Tenant One Updated',
  );

  await page.getByTestId('platform-tenant-details-action-stores').click();
  await expect(page).toHaveURL('/app/platform/tenants/tenant-1/stores');

  await page.goBack();
  await page.getByTestId('platform-tenant-details-action-users').click();
  await expect(page).toHaveURL('/app/admin/users?tenantId=tenant-1');

  await page.goBack();
  await page.getByTestId('platform-tenant-details-action-review-stores-without-admin').click();
  await expect(page).toHaveURL('/app/platform/tenants/tenant-1/stores?withoutAdminStore=true');

  await page.goto('/app/platform/tenants/tenant-1');
  await page.getByTestId('platform-tenant-details-action-dashboard').click();
  await expect(page).toHaveURL('/app/platform/dashboard?tenantId=tenant-1');

  await page.goto('/app/platform/tenants/tenant-1');
  await page.getByTestId('platform-tenant-details-action-inventory').click();
  await expect(page).toHaveURL('/app/admin/pos/inventory?tenantId=tenant-1&storeId=store-1');
});
