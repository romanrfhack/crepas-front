import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { AdminUsersService } from '../../services/admin-users.service';
import { UsersAdminPage } from './users-admin.page';

describe('UsersAdminPage', () => {
  let fixture: ComponentFixture<UsersAdminPage>;
  let queryParams: Record<string, string>;
  let getUsersMock: ReturnType<typeof vi.fn>;
  let getUserOptionsMock: ReturnType<typeof vi.fn>;
  let createUserMock: ReturnType<typeof vi.fn>;
  let setTemporaryPasswordMock: ReturnType<typeof vi.fn>;
  let updateUserMock: ReturnType<typeof vi.fn>;
  let routerNavigateMock: ReturnType<typeof vi.fn>;

  const buildOptionsResponse = () => ({
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
      { id: 'tenant-q', name: 'Empresa Query' },
      { id: 'tenant-ctx', name: 'Empresa Contexto' },
      { id: 'tenant-only', name: 'Empresa Unica' },
      { id: 'tenant-a', name: 'Empresa A' },
    ],
    stores: [
      { id: 'store-1', tenantId: 'tenant-1', name: 'Sucursal Uno' },
      { id: 'store-q', tenantId: 'tenant-q', name: 'Sucursal Query' },
      { id: 'store-ctx', tenantId: 'tenant-ctx', name: 'Sucursal Contexto' },
      { id: 'store-b', tenantId: 'tenant-a', name: 'Sucursal B' },
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
  });

  const buildUsersResponse = () => ({
    items: [
      {
        id: 'user-1',
        email: 'user@example.com',
        userName: 'User One',
        isLockedOut: false,
        roles: ['TenantAdmin'],
        tenantId: 'tenant-1',
        storeId: null,
        displayName: 'User One',
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
  });

  const createComponent = async (usersResponse = buildUsersResponse()) => {
    getUsersMock = vi.fn().mockResolvedValue(usersResponse);
    getUserOptionsMock = vi.fn().mockResolvedValue(buildOptionsResponse());
    createUserMock = vi.fn().mockResolvedValue({
      id: 'user-2',
      email: 'new@example.com',
      userName: 'new.user',
      roles: ['AdminStore'],
      tenantId: 'tenant-ctx',
      storeId: 'store-ctx',
      isLockedOut: false,
    });
    setTemporaryPasswordMock = vi.fn().mockResolvedValue({ message: 'Contraseña temporal restablecida.' });
    updateUserMock = vi.fn().mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      userName: 'User Updated',
      isLockedOut: false,
      roles: ['TenantAdmin'],
      tenantId: 'tenant-1',
      storeId: null,
    });
    routerNavigateMock = vi.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [UsersAdminPage],
      providers: [
        {
          provide: AdminUsersService,
          useValue: {
            getUsers: getUsersMock,
            getUserOptions: getUserOptionsMock,
            createUser: createUserMock,
            setTemporaryPassword: setTemporaryPasswordMock,
            updateUser: updateUserMock,
            updateUserRoles: vi.fn().mockResolvedValue({
              id: 'user-1',
              email: 'user@example.com',
              userName: 'User One',
              isLockedOut: false,
              roles: ['AdminStore'],
              tenantId: 'tenant-1',
              storeId: 'store-1',
            }),
            setUserLockState: vi.fn().mockResolvedValue({
              id: 'user-1',
              email: 'user@example.com',
              userName: 'User One',
              isLockedOut: true,
              roles: ['AdminStore'],
              tenantId: 'tenant-1',
              storeId: 'store-1',
            }),
          },
        },
        { provide: Router, useValue: { navigate: routerNavigateMock } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap(queryParams),
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UsersAdminPage);
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
  };

  beforeEach(() => {
    queryParams = {};
  });

  it('renders readable labels without visible technical ids', async () => {
    await createComponent();

    const host = fixture.nativeElement as HTMLElement;
    const text = host.textContent ?? '';

    expect(text).toContain('Empresa Uno');
    expect(text).toContain('Administrador de empresa');
    expect(text).not.toContain('tenant-1');
    expect(text).not.toContain('store-1');
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    expect(text).not.toMatch(/\b(tenantId|storeId|userId|roleId|TenantId|StoreId|UserId|RoleId)\b/);
  });

  it('hides all row actions when allowedActions are false', async () => {
    const response = buildUsersResponse();
    await createComponent({
      ...response,
      items: [
        {
          ...response.items[0],
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
    });

    const host = fixture.nativeElement as HTMLElement;
    const row = host.querySelector('[data-testid="admin-users-row-user-no-actions"]') as HTMLElement;

    expect(row).not.toBeNull();
    expect(row.querySelector('[data-testid="admin-user-role-update"]')).toBeNull();
    expect(row.querySelector('[data-testid="admin-users-reset-password-open-user-no-actions"]')).toBeNull();
    expect(row.querySelector('[data-testid="admin-users-edit-open-user-no-actions"]')).toBeNull();
    expect(row.querySelector('[data-testid="admin-users-lock-user-no-actions"]')).toBeNull();
    expect(row.querySelector('[data-testid="admin-users-unlock-user-no-actions"]')).toBeNull();
    expect(row.textContent ?? '').not.toMatch(/Editar|Bloquear|Desbloquear|Restablecer contraseña|Guardar rol/);
  });


  it('auto-opens create form when intent=create-user and applies suggestedRole from query', async () => {
    queryParams = {
      tenantId: 'tenant-q',
      storeId: 'store-q',
      intent: 'create-user',
      suggestedRole: 'AdminStore',
    };

    await createComponent();

    const component = fixture.componentInstance;
    expect(component.createFormVisible()).toBe(true);
    expect(component.createIntentActive()).toBe(true);
    expect(component.createTenantControl.value).toBe('tenant-q');
    expect(component.createStoreControl.value).toBe('store-q');
    expect(component.createRoleControl.value).toBe('AdminStore');

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-testid="admin-users-create-intent-active"]')).not.toBeNull();
  });

  it('close create form clears intent state and keeps tenant/store filters', async () => {
    queryParams = {
      tenantId: 'tenant-q',
      storeId: 'store-q',
      intent: 'create-user',
      suggestedRole: 'AdminStore',
    };

    await createComponent();

    const component = fixture.componentInstance;
    component.closeCreateForm();
    fixture.detectChanges();

    expect(component.createFormVisible()).toBe(false);
    expect(component.createIntentActive()).toBe(false);
    expect(component.tenantFilterControl.value).toBe('tenant-q');
    expect(component.storeFilterControl.value).toBe('store-q');
  });

  it('keeps query prefill and role suggestion for tenant + store context', async () => {
    queryParams = { tenantId: 'tenant-q', storeId: 'store-q' };

    await createComponent();

    const component = fixture.componentInstance;
    component.openCreateFormFromContext();
    fixture.detectChanges();

    expect(component.createTenantControl.value).toBe('tenant-q');
    expect(component.createStoreControl.value).toBe('store-q');
    expect(component.createRoleControl.value).toBe('AdminStore');
  });

  it('opens reset password modal from user row action', async () => {
    await createComponent();

    const openButton = fixture.nativeElement.querySelector(
      '[data-testid="admin-users-reset-password-open-user-1"]',
    ) as HTMLButtonElement;
    openButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="admin-users-reset-password-modal"]')).not.toBeNull();
    expect(fixture.componentInstance.resetTargetUser()?.id).toBe('user-1');
  });

  it('submits create user, shows success and refreshes list', async () => {
    queryParams = { tenantId: 'tenant-ctx', storeId: 'store-ctx' };

    await createComponent();

    const component = fixture.componentInstance;
    component.openCreateFormFromContext();
    component.createRoleControl.setValue('AdminStore');
    component.createTenantControl.setValue('tenant-ctx');
    component.createStoreControl.setValue('store-ctx');
    component.createEmailControl.setValue('new@example.com');
    component.createUserNameControl.setValue('new.user');
    component.createPasswordControl.setValue('Temp123!');

    await component.onSubmitCreate(new Event('submit'));
    fixture.detectChanges();

    expect(createUserMock).toHaveBeenCalledWith({
      email: 'new@example.com',
      userName: 'new.user',
      role: 'AdminStore',
      tenantId: 'tenant-ctx',
      storeId: 'store-ctx',
      temporaryPassword: 'Temp123!',
    });
    expect(component.successMessage()).toBe('Usuario creado correctamente.');
    expect(getUsersMock).toHaveBeenCalledTimes(2);
  });

  it('validates reset password min length before submit', async () => {
    await createComponent();

    const component = fixture.componentInstance;
    component.openResetPassword(buildUsersResponse().items[0]);
    component.resetPasswordControl.setValue('1234567');
    component.resetPasswordConfirmControl.setValue('1234567');

    await component.onSubmitResetPassword(new Event('submit'));

    expect(setTemporaryPasswordMock).not.toHaveBeenCalled();
    expect(component.resetPasswordError()).toContain('al menos 8');
  });

  it('validates reset password confirmation mismatch', async () => {
    await createComponent();

    const component = fixture.componentInstance;
    component.openResetPassword(buildUsersResponse().items[0]);
    component.resetPasswordControl.setValue('Temp1234!');
    component.resetPasswordConfirmControl.setValue('Temp9999!');

    await component.onSubmitResetPassword(new Event('submit'));

    expect(setTemporaryPasswordMock).not.toHaveBeenCalled();
    expect(component.resetPasswordError()).toContain('no coincide');
  });

  it('submits reset password successfully and shows stable success', async () => {
    await createComponent();

    const component = fixture.componentInstance;
    component.openResetPassword(buildUsersResponse().items[0]);
    component.resetPasswordControl.setValue('Temp1234!');
    component.resetPasswordConfirmControl.setValue('Temp1234!');

    await component.onSubmitResetPassword(new Event('submit'));

    expect(setTemporaryPasswordMock).toHaveBeenCalledWith('user-1', { temporaryPassword: 'Temp1234!' });
    expect(component.resetPasswordSuccess()).toContain('restablecida');
    expect(component.resetPasswordError()).toBe('');
  });

  it.each([
    [400, { errors: { temporaryPassword: ['Policy failed.'] } }, 'Policy failed'],
    [403, { detail: 'Forbidden by scope.' }, 'Forbidden by scope'],
    [404, { detail: 'User not found.' }, 'User not found'],
  ])(
    'maps backend reset password errors for status %s',
    async (status: number, errorBody: unknown, expected: string) => {
      await createComponent();

      setTemporaryPasswordMock.mockRejectedValueOnce(
        new HttpErrorResponse({
          status,
          error: errorBody,
        }),
      );

      const component = fixture.componentInstance;
      component.openResetPassword(buildUsersResponse().items[0]);
      component.resetPasswordControl.setValue('Temp1234!');
      component.resetPasswordConfirmControl.setValue('Temp1234!');

      await component.onSubmitResetPassword(new Event('submit'));

      expect(component.resetPasswordError()).toContain(expected);
      expect(component.resetPasswordSuccess()).toBe('');
    },
  );

  it('shows conflict message mapped from ProblemDetails', async () => {
    await createComponent();

    createUserMock.mockRejectedValueOnce(
      new HttpErrorResponse({
        status: 409,
        error: { detail: 'El email ya existe.' },
      }),
    );

    const component = fixture.componentInstance;
    component.openCreateFormFromContext();
    component.createRoleControl.setValue('TenantAdmin');
    component.createTenantControl.setValue('tenant-1');
    component.createEmailControl.setValue('dup@example.com');
    component.createUserNameControl.setValue('dup.user');
    component.createPasswordControl.setValue('Temp123!');

    await component.onSubmitCreate(new Event('submit'));

    expect(component.errorMessage()).toContain('El email ya existe');
  });

  it('validates required store for scoped roles before submit', async () => {
    await createComponent();

    const component = fixture.componentInstance;
    component.openCreateFormFromContext();
    component.createRoleControl.setValue('Manager');
    component.createTenantControl.setValue('tenant-1');
    component.createStoreControl.setValue('');
    component.createEmailControl.setValue('manager@example.com');
    component.createUserNameControl.setValue('manager.user');
    component.createPasswordControl.setValue('Temp123!');

    await component.onSubmitCreate(new Event('submit'));

    expect(createUserMock).not.toHaveBeenCalled();
    expect(component.errorMessage()).toContain('Selecciona una sucursal');
  });

  it('shows backend validation errors for tenant/store mismatch', async () => {
    await createComponent();

    createUserMock.mockRejectedValueOnce(
      new HttpErrorResponse({
        status: 400,
        error: {
          errors: {
            storeId: ['Store no pertenece al tenant.'],
          },
        },
      }),
    );

    const component = fixture.componentInstance;
    component.openCreateFormFromContext();
    component.createRoleControl.setValue('AdminStore');
    component.createTenantControl.setValue('tenant-a');
    component.createStoreControl.setValue('store-b');
    component.createEmailControl.setValue('new@example.com');
    component.createUserNameControl.setValue('new.user');
    component.createPasswordControl.setValue('Temp123!');

    await component.onSubmitCreate(new Event('submit'));

    expect(component.errorMessage()).toContain('sucursal no pertenece');
  });

  it('opens edit modal from row and prefills userName/tenant/store', async () => {
    await createComponent();

    const component = fixture.componentInstance;
    component.openEditUser(buildUsersResponse().items[0]);

    expect(component.editModalOpen()).toBe(true);
    expect(component.editUserNameControl.value).toBe('User One');
    expect(component.editTenantControl.value).toBe('tenant-1');
    expect(component.editStoreControl.value).toBe('');
  });

  it('validates store in edit form for store-required role', async () => {
    await createComponent();

    const component = fixture.componentInstance;
    component.openEditUser({
      id: 'user-2',
      email: 'cashier@example.com',
      userName: 'Cashier',
      isLockedOut: false,
      roles: ['Cashier'],
      tenantId: 'tenant-1',
      storeId: null,
      allowedActions: {
        canEdit: true,
        canChangeRole: true,
        canChangeScope: true,
        canLock: true,
        canUnlock: false,
        canResetTemporaryPassword: true,
      },
    });
    component.editUserNameControl.setValue('Cashier');
    component.editTenantControl.setValue('tenant-1');
    component.editStoreControl.setValue('');

    await component.onSubmitEditUser(new Event('submit'));

    expect(updateUserMock).not.toHaveBeenCalled();
    expect(component.editError()).toContain('Selecciona una sucursal');
  });

  it('submits edit successfully, calls endpoint and refreshes list', async () => {
    await createComponent();

    const component = fixture.componentInstance;
    component.openEditUser(buildUsersResponse().items[0]);
    component.editUserNameControl.setValue('updated-name');
    component.editTenantControl.setValue('tenant-1');
    component.editStoreControl.setValue('');

    await component.onSubmitEditUser(new Event('submit'));

    expect(updateUserMock).toHaveBeenCalledWith('user-1', {
      userName: 'updated-name',
      tenantId: 'tenant-1',
      storeId: null,
    });
    expect(getUsersMock).toHaveBeenCalledTimes(2);
    expect(component.editSuccess()).toContain('actualizado');
  });

  it.each([
    [400, { errors: { storeId: ['Store inválido.'] } }, 'sucursal inválido'],
    [403, { detail: 'Forbidden by scope.' }, 'Forbidden by scope'],
    [404, { detail: 'User not found.' }, 'User not found'],
    [409, { detail: 'UserName duplicado.' }, 'nombre de usuario duplicado'],
  ])('maps edit backend errors for status %s', async (status: number, errorBody: unknown, expected: string) => {
    await createComponent();

    updateUserMock.mockRejectedValueOnce(
      new HttpErrorResponse({
        status,
        error: errorBody,
      }),
    );

    const component = fixture.componentInstance;
    component.openEditUser(buildUsersResponse().items[0]);
    component.editUserNameControl.setValue('updated-name');
    component.editTenantControl.setValue('tenant-1');
    component.editStoreControl.setValue('');

    await component.onSubmitEditUser(new Event('submit'));

    expect(component.editError()).toContain(expected);
    expect(component.editSuccess()).toBe('');
  });
});
