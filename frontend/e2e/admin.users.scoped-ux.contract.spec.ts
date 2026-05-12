import { expect, test, type Route } from '@playwright/test';

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

const optionsResponse = {
  roles: [
    { name: 'TenantAdmin', displayName: 'Administrador de empresa', level: 80 },
    { name: 'AdminStore', displayName: 'Administrador de sucursal', level: 60 },
    { name: 'Manager', displayName: 'Supervisor', level: 40 },
    { name: 'Cashier', displayName: 'Cajero', level: 30 },
    { name: 'Collector', displayName: 'Gestor de cobranza', level: 30 },
    { name: 'User', displayName: 'Usuario', level: 10 },
  ],
  tenants: [
    { id: 'tenant-1', name: 'Empresa Uno' },
    { id: 'tenant-ctx', name: 'Empresa Contexto' },
    { id: 'tenant-only', name: 'Empresa Tenant' },
  ],
  stores: [
    { id: 'store-ctx', tenantId: 'tenant-ctx', name: 'Sucursal Contexto' },
    { id: 'store-1', tenantId: 'tenant-1', name: 'Sucursal Uno' },
  ],
  currentScope: {
    role: 'SuperAdmin',
    roleDisplayName: 'Superadministrador',
    roleLevel: 100,
    tenantId: null,
    tenantName: null,
    storeId: null,
    storeName: null,
  },
};

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
      displayName: 'User 1',
      primaryRole: { name: 'TenantAdmin', displayName: 'Administrador de empresa', level: 80 },
      roleDetails: [{ name: 'TenantAdmin', displayName: 'Administrador de empresa', level: 80 }],
      tenant: { id: 'tenant-1', name: 'Empresa Uno' },
      store: null,
      status: { isLockedOut: false, lockoutEnd: null, label: 'Activo' },
      allowedActions: {
        canEdit: true,
        canChangeRole: true,
        canChangeScope: true,
        canLock: true,
        canUnlock: false,
        canResetTemporaryPassword: true,
      },
    },
  ],
  totalCount: 1,
  pageNumber: 1,
  pageSize: 20,
};

const fulfillOptions = (route: Route) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(optionsResponse),
  });

const isOptionsRequest = (route: Route) =>
  route.request().method() === 'GET' &&
  route.request().url().includes('/api/v1/admin/users/options');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    (token: string) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'refresh-e2e');
    },
    buildJwt(['SuperAdmin']),
  );

  await page.route('**/api/v1/admin/roles', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(rolesResponse),
    }),
  );
});

test('table and filters render display names without exposing tenant/store ids', async ({
  page,
}) => {
  await page.route('**/api/v1/admin/users**', (route) => {
    if (isOptionsRequest(route)) {
      return fulfillOptions(route);
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(usersResponse),
    });
  });

  await page.goto('/app/admin/users');

  await expect(page.getByTestId('admin-users-page')).toContainText('Alcance global');
  await expect(page.locator('tbody').getByText('Empresa Uno')).toBeVisible();
  await expect(page.getByTestId('admin-users-role-user-1')).toContainText(
    'Administrador de empresa',
  );
  await expect(page.getByTestId('admin-users-page')).not.toContainText('tenant-1');
  await expect(page.getByTestId('admin-users-page')).not.toContainText('store-1');
  await expect(page.getByTestId('admin-users-page')).not.toContainText(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  );
  await expect(page.getByTestId('admin-users-page')).not.toContainText(
    /\b(tenantId|storeId|userId|roleId|TenantId|StoreId|UserId|RoleId)\b/,
  );
  await expect(page.getByTestId('admin-users-filter-tenant')).toContainText('Empresa Contexto');
  await expect(page.getByTestId('admin-users-filter-store')).toContainText('Sucursal Contexto');
});

test('options failure shows scope error and does not leave scope loading stuck', async ({
  page,
}) => {
  await page.route('**/api/v1/admin/users**', (route) => {
    if (isOptionsRequest(route)) {
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Options unavailable.' }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(usersResponse),
    });
  });

  await page.goto('/app/admin/users');

  await expect(page.getByTestId('admin-users-options-error')).toBeVisible();
  await expect(page.getByTestId('admin-users-page')).toContainText(
    'No se pudo cargar el alcance permitido.',
  );
  await expect(page.getByTestId('admin-users-page')).not.toContainText(
    'Cargando alcance permitido...',
  );
  await expect(page.getByTestId('admin-users-create-open')).toBeDisabled();
  await expect(page.getByTestId('admin-users-create-disabled-reason')).toContainText(
    'No se pudo cargar el alcance permitido.',
  );
});

test('table resolves tenant and store names from options when users only include ids', async ({
  page,
}) => {
  const usersWithIdsOnly = {
    ...usersResponse,
    items: [
      {
        ...usersResponse.items[0],
        tenant: null,
        store: null,
        tenantId: 'tenant-ctx',
        storeId: 'store-ctx',
      },
    ],
  };

  await page.route('**/api/v1/admin/users**', (route) => {
    if (isOptionsRequest(route)) {
      return fulfillOptions(route);
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(usersWithIdsOnly),
    });
  });

  await page.goto('/app/admin/users');

  const row = page.getByTestId('admin-users-row-user-1');
  await expect(row).toContainText('Empresa Contexto');
  await expect(row).toContainText('Sucursal Contexto');
  await expect(page.getByTestId('admin-users-page')).not.toContainText('tenant-ctx');
  await expect(page.getByTestId('admin-users-page')).not.toContainText('store-ctx');
});

test('rows without allowed actions do not render action controls', async ({ page }) => {
  const noActionsResponse = {
    ...usersResponse,
    items: [
      {
        ...usersResponse.items[0],
        id: 'user-no-actions',
        allowedActions: {
          canEdit: false,
          canChangeRole: false,
          canChangeScope: false,
          canLock: false,
          canUnlock: false,
          canResetTemporaryPassword: false,
        },
      },
    ],
  };

  await page.route('**/api/v1/admin/users**', (route) => {
    if (isOptionsRequest(route)) {
      return fulfillOptions(route);
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(noActionsResponse),
    });
  });

  await page.goto('/app/admin/users');

  const row = page.getByTestId('admin-users-row-user-no-actions');
  await expect(row).toBeVisible();
  await expect(row.getByText('Editar')).toHaveCount(0);
  await expect(row.getByText('Bloquear')).toHaveCount(0);
  await expect(row.getByText('Desbloquear')).toHaveCount(0);
  await expect(row.getByText('Restablecer contraseña')).toHaveCount(0);
  await expect(row.getByText('Guardar rol')).toHaveCount(0);
});

test('filters issue server queries with selected role, tenant, store and status', async ({
  page,
}) => {
  let lastUsersUrl = '';

  await page.route('**/api/v1/admin/users**', (route) => {
    if (isOptionsRequest(route)) {
      return fulfillOptions(route);
    }

    if (route.request().method() === 'GET') {
      lastUsersUrl = route.request().url();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(usersResponse),
      });
    }

    return route.continue();
  });

  await page.goto('/app/admin/users');
  await page.getByTestId('admin-users-filter-role').selectOption('Manager');
  await page.getByTestId('admin-users-filter-store').selectOption('store-ctx');
  await page.getByTestId('admin-users-filter-tenant').selectOption('tenant-ctx');
  await page.getByTestId('admin-users-filter-status').selectOption('locked');

  await expect.poll(() => new URL(lastUsersUrl).searchParams.get('role')).toBe('Manager');
  expect(new URL(lastUsersUrl).searchParams.get('tenantId')).toBe('tenant-ctx');
  expect(new URL(lastUsersUrl).searchParams.get('storeId')).toBe('store-ctx');
  expect(new URL(lastUsersUrl).searchParams.get('status')).toBe('locked');
  expect(new URL(lastUsersUrl).searchParams.get('page')).toBe('1');
});

test('admin store scope keeps tenant and store fixed in create form', async ({ page }) => {
  await page.addInitScript(
    (token: string) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'refresh-e2e');
    },
    buildJwt(['AdminStore'], 'tenant-fixed', 'store-fixed'),
  );

  const adminStoreOptions = {
    ...optionsResponse,
    roles: [
      { name: 'Manager', displayName: 'Supervisor', level: 40 },
      { name: 'Cashier', displayName: 'Cajero', level: 30 },
      { name: 'Collector', displayName: 'Gestor de cobranza', level: 30 },
      { name: 'User', displayName: 'Usuario', level: 10 },
    ],
    tenants: [{ id: 'tenant-fixed', name: 'Empresa Fija' }],
    stores: [{ id: 'store-fixed', tenantId: 'tenant-fixed', name: 'Sucursal Fija' }],
    currentScope: {
      role: 'AdminStore',
      roleDisplayName: 'Administrador de sucursal',
      roleLevel: 60,
      tenantId: 'tenant-fixed',
      tenantName: 'Empresa Fija',
      storeId: 'store-fixed',
      storeName: 'Sucursal Fija',
    },
  };

  await page.route('**/api/v1/admin/users**', (route) => {
    if (isOptionsRequest(route)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(adminStoreOptions),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(usersResponse),
    });
  });

  await page.goto('/app/admin/users');
  await page.getByTestId('admin-users-create-open').click();

  await expect(page.getByTestId('admin-users-create-context-tenant')).toContainText('Empresa Fija');
  await expect(page.getByTestId('admin-users-create-context-store')).toContainText('Sucursal Fija');
  await expect(page.getByTestId('admin-user-form-tenant')).toHaveValue('tenant-fixed');
  await expect(page.getByTestId('admin-user-form-store')).toHaveValue('store-fixed');
  await expect(page.getByTestId('admin-user-form-tenant')).toBeDisabled();
  await expect(page.getByTestId('admin-user-form-store')).toBeDisabled();
});

test('create user success from tenant+store context submits POST and refreshes list', async ({
  page,
}) => {
  let getUsersCalls = 0;
  await page.route('**/api/v1/admin/users**', (route) => {
    const method = route.request().method();
    if (isOptionsRequest(route)) {
      return fulfillOptions(route);
    }

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

  await expect(page.getByTestId('admin-users-create-context-tenant')).toContainText(
    'Empresa Contexto',
  );
  await expect(page.getByTestId('admin-users-create-context-store')).toContainText(
    'Sucursal Contexto',
  );
  await expect(page.getByTestId('admin-user-form').getByTestId('admin-user-form-role')).toHaveValue(
    'AdminStore',
  );

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

test('reset temporary password success flow submits backend contract and shows success testid', async ({
  page,
}) => {
  await page.route('**/api/v1/admin/users**', (route) => {
    if (isOptionsRequest(route)) {
      return fulfillOptions(route);
    }

    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(usersResponse),
      });
    }

    const resetBody = route.request().postDataJSON() as { temporaryPassword: string };
    expect(route.request().url()).toContain('/api/v1/admin/users/user-1/temporary-password');
    expect(resetBody).toEqual({ temporaryPassword: 'Temp1234!' });

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'user-1',
        email: 'user1@test.local',
        userName: 'User 1',
        roles: ['TenantAdmin'],
        tenantId: 'tenant-1',
        storeId: null,
        message: 'Temporary password set.',
      }),
    });
  });

  await page.goto('/app/admin/users');
  await page.getByTestId('admin-users-reset-password-open-user-1').click();

  await expect(page.getByTestId('admin-users-reset-password-modal')).toBeVisible();
  await expect(page.getByTestId('admin-users-reset-password-user')).toBeVisible();

  await page.getByTestId('admin-users-reset-password-password').fill('Temp1234!');
  await page.getByTestId('admin-users-reset-password-confirm').fill('Temp1234!');
  await page.getByTestId('admin-users-reset-password-submit').click();

  await expect(page.getByTestId('admin-users-reset-password-success')).toBeVisible();
  await expect(page.getByTestId('admin-users-reset-password-error')).toHaveCount(0);
});

test('reset temporary password shows stable error testid for backend 400 and 403', async ({
  page,
}) => {
  let currentStatus: 400 | 403 = 400;

  await page.route('**/api/v1/admin/users**', (route) => {
    if (isOptionsRequest(route)) {
      return fulfillOptions(route);
    }

    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(usersResponse),
      });
    }

    if (currentStatus === 400) {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ errors: { temporaryPassword: ['TemporaryPassword is required.'] } }),
      });
    }

    return route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Forbidden by scope.' }),
    });
  });

  await page.goto('/app/admin/users');
  await page.getByTestId('admin-users-reset-password-open-user-1').click();

  await page.getByTestId('admin-users-reset-password-password').fill('Temp1234!');
  await page.getByTestId('admin-users-reset-password-confirm').fill('Temp1234!');
  await page.getByTestId('admin-users-reset-password-submit').click();
  await expect(page.getByTestId('admin-users-reset-password-error')).toBeVisible();

  currentStatus = 403;
  await page.getByTestId('admin-users-reset-password-submit').click();
  await expect(page.getByTestId('admin-users-reset-password-error')).toBeVisible();
});

test('create user error maps conflict and validation responses with stable error testid', async ({
  page,
}) => {
  await page.route('**/api/v1/admin/users**', async (route) => {
    if (isOptionsRequest(route)) {
      return fulfillOptions(route);
    }

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
  await page.route('**/api/v1/admin/users**', (route) => {
    if (isOptionsRequest(route)) {
      return fulfillOptions(route);
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(usersResponse),
    });
  });

  await page.goto('/app/admin/users?tenantId=tenant-only');
  await page.getByTestId('admin-users-create-open').click();

  await expect(page.getByTestId('admin-users-create-context-tenant')).toContainText(
    'Empresa Tenant',
  );
  await expect(page.getByTestId('admin-users-create-context-store')).toContainText(
    'Sin seleccionar',
  );
  await expect(page.getByTestId('admin-user-form').getByTestId('admin-user-form-role')).toHaveValue(
    'TenantAdmin',
  );
});

test('edit user success flow submits PUT and refreshes list', async ({ page }) => {
  let getUsersCalls = 0;

  await page.route('**/api/v1/admin/users**', (route) => {
    const method = route.request().method();
    if (isOptionsRequest(route)) {
      return fulfillOptions(route);
    }

    if (method === 'GET') {
      getUsersCalls += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(usersResponse),
      });
    }

    if (method === 'PUT' && route.request().url().includes('/api/v1/admin/users/user-1')) {
      expect(route.request().postDataJSON()).toEqual({
        userName: 'User 1 Updated',
        tenantId: 'tenant-1',
        storeId: null,
      });
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-1',
          email: 'user1@test.local',
          userName: 'User 1 Updated',
          isLockedOut: false,
          roles: ['TenantAdmin'],
          tenantId: 'tenant-1',
          storeId: null,
        }),
      });
    }

    return route.continue();
  });

  await page.goto('/app/admin/users');
  await page.getByTestId('admin-users-edit-open-user-1').click();

  await expect(page.getByTestId('admin-user-edit-form')).toBeVisible();
  await expect(page.getByTestId('admin-user-edit-username')).toHaveValue('User 1');
  await expect(page.getByTestId('admin-user-edit-tenant')).toHaveValue('tenant-1');
  await page.getByTestId('admin-user-edit-username').fill('User 1 Updated');
  await page.getByTestId('admin-user-edit-submit').click();

  await expect(page.getByTestId('admin-user-edit-success')).toBeVisible();
  await expect(page.getByTestId('admin-user-edit-error')).toHaveCount(0);
  expect(getUsersCalls).toBeGreaterThanOrEqual(2);
});

test('edit user error flow renders stable error testid', async ({ page }) => {
  await page.route('**/api/v1/admin/users**', (route) => {
    if (isOptionsRequest(route)) {
      return fulfillOptions(route);
    }

    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(usersResponse),
      });
    }

    if (
      route.request().method() === 'PUT' &&
      route.request().url().includes('/api/v1/admin/users/user-1')
    ) {
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Forbidden by scope.' }),
      });
    }

    return route.continue();
  });

  await page.goto('/app/admin/users');
  await page.getByTestId('admin-users-edit-open-user-1').click();
  await page.getByTestId('admin-user-edit-username').fill('User 1 Updated');
  await page.getByTestId('admin-user-edit-submit').click();

  await expect(page.getByTestId('admin-user-edit-error')).toBeVisible();
});
