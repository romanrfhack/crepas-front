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

    await TestBed.configureTestingModule({
      imports: [UsersAdminPage],
      providers: [
        {
          provide: AdminUsersService,
          useValue: {
            getUsers: getUsersMock,
            createUser: createUserMock,
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
});
