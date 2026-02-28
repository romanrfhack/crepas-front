import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { AuthService } from '../../../auth/services/auth.service';
import { AdminRolesService } from '../../services/admin-roles.service';
import { AdminUsersService } from '../../services/admin-users.service';
import { UsersAdminPage } from './users-admin.page';

describe('UsersAdminPage', () => {
  let fixture: ComponentFixture<UsersAdminPage>;
  let queryParams: Record<string, string>;
  let authMock: {
    hasRole: (role: string) => boolean;
    getTenantId: () => string | null;
    getStoreId: () => string | null;
  };
  let getUsersMock: ReturnType<typeof vi.fn>;
  let createUserMock: ReturnType<typeof vi.fn>;
  let setTemporaryPasswordMock: ReturnType<typeof vi.fn>;
  let updateUserMock: ReturnType<typeof vi.fn>;

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
      },
    ],
    totalCount: 1,
    pageNumber: 1,
    pageSize: 20,
  });

  const createComponent = async () => {
    getUsersMock = vi.fn().mockResolvedValue(buildUsersResponse());
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

    await TestBed.configureTestingModule({
      imports: [UsersAdminPage],
      providers: [
        {
          provide: AdminUsersService,
          useValue: {
            getUsers: getUsersMock,
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
        {
          provide: AdminRolesService,
          useValue: {
            getRoles: async () => [
              { name: 'SuperAdmin' },
              { name: 'TenantAdmin' },
              { name: 'AdminStore' },
              { name: 'Manager' },
              { name: 'Cashier' },
            ],
          },
        },
        { provide: AuthService, useValue: authMock },
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
    fixture.detectChanges();
  };

  beforeEach(() => {
    queryParams = {};
  });


  it('auto-opens create form when intent=create-user and applies suggestedRole from query', async () => {
    queryParams = {
      tenantId: 'tenant-q',
      storeId: 'store-q',
      intent: 'create-user',
      suggestedRole: 'AdminStore',
    };
    authMock = {
      hasRole: (role: string) => role === 'SuperAdmin',
      getTenantId: () => null,
      getStoreId: () => null,
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
    authMock = {
      hasRole: (role: string) => role === 'SuperAdmin',
      getTenantId: () => null,
      getStoreId: () => null,
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
    authMock = {
      hasRole: (role: string) => role === 'SuperAdmin',
      getTenantId: () => null,
      getStoreId: () => null,
    };

    await createComponent();

    const component = fixture.componentInstance;
    component.openCreateFormFromContext();
    fixture.detectChanges();

    expect(component.createTenantControl.value).toBe('tenant-q');
    expect(component.createStoreControl.value).toBe('store-q');
    expect(component.createRoleControl.value).toBe('AdminStore');
  });

  it('opens reset password modal from user row action', async () => {
    authMock = {
      hasRole: (role: string) => role === 'SuperAdmin',
      getTenantId: () => null,
      getStoreId: () => null,
    };

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
    authMock = {
      hasRole: (role: string) => role === 'SuperAdmin',
      getTenantId: () => null,
      getStoreId: () => null,
    };

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
    expect(component.successMessage()).toBe('Usuario creado.');
    expect(getUsersMock).toHaveBeenCalledTimes(2);
  });

  it('validates reset password min length before submit', async () => {
    authMock = {
      hasRole: (role: string) => role === 'SuperAdmin',
      getTenantId: () => null,
      getStoreId: () => null,
    };

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
    authMock = {
      hasRole: (role: string) => role === 'SuperAdmin',
      getTenantId: () => null,
      getStoreId: () => null,
    };

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
    authMock = {
      hasRole: (role: string) => role === 'SuperAdmin',
      getTenantId: () => null,
      getStoreId: () => null,
    };

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
      authMock = {
        hasRole: (role: string) => role === 'SuperAdmin',
        getTenantId: () => null,
        getStoreId: () => null,
      };
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
    authMock = {
      hasRole: (role: string) => role === 'SuperAdmin',
      getTenantId: () => null,
      getStoreId: () => null,
    };
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
    authMock = {
      hasRole: (role: string) => role === 'SuperAdmin',
      getTenantId: () => null,
      getStoreId: () => null,
    };
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
    expect(component.errorMessage()).toContain('StoreId es obligatorio');
  });

  it('shows backend validation errors for tenant/store mismatch', async () => {
    authMock = {
      hasRole: (role: string) => role === 'SuperAdmin',
      getTenantId: () => null,
      getStoreId: () => null,
    };
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

    expect(component.errorMessage()).toContain('Store no pertenece al tenant');
  });

  it('opens edit modal from row and prefills userName/tenant/store', async () => {
    authMock = {
      hasRole: (role: string) => role === 'SuperAdmin',
      getTenantId: () => null,
      getStoreId: () => null,
    };
    await createComponent();

    const component = fixture.componentInstance;
    component.openEditUser(buildUsersResponse().items[0]);

    expect(component.editModalOpen()).toBe(true);
    expect(component.editUserNameControl.value).toBe('User One');
    expect(component.editTenantControl.value).toBe('tenant-1');
    expect(component.editStoreControl.value).toBe('');
  });

  it('shows visual store required flag in edit form for store-required role', async () => {
    authMock = {
      hasRole: (role: string) => role === 'SuperAdmin',
      getTenantId: () => null,
      getStoreId: () => null,
    };
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
    });

    expect(component.editStoreRequiredForCurrentRoles()).toBe(true);
  });

  it('submits edit successfully, calls endpoint and refreshes list', async () => {
    authMock = {
      hasRole: (role: string) => role === 'SuperAdmin',
      getTenantId: () => null,
      getStoreId: () => null,
    };
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
    [400, { errors: { storeId: ['Store inválido.'] } }, 'Store inválido'],
    [403, { detail: 'Forbidden by scope.' }, 'Forbidden by scope'],
    [404, { detail: 'User not found.' }, 'User not found'],
    [409, { detail: 'UserName duplicado.' }, 'UserName duplicado'],
  ])('maps edit backend errors for status %s', async (status: number, errorBody: unknown, expected: string) => {
    authMock = {
      hasRole: (role: string) => role === 'SuperAdmin',
      getTenantId: () => null,
      getStoreId: () => null,
    };
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
