import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UsersAdminPage } from './users-admin.page';
import { AdminUsersService } from '../../services/admin-users.service';
import { AdminRolesService } from '../../services/admin-roles.service';
import { AuthService } from '../../../auth/services/auth.service';

describe('UsersAdminPage', () => {
  let fixture: ComponentFixture<UsersAdminPage>;
  let authMock: {
    hasRole: (role: string) => boolean;
    getTenantId: () => string | null;
    getStoreId: () => string | null;
  };

  const createComponent = async () => {
    await TestBed.configureTestingModule({
      imports: [UsersAdminPage],
      providers: [
        {
          provide: AdminUsersService,
          useValue: {
            getUsers: async () => ({
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
            }),
            updateUserRoles: async () => ({
              id: 'user-1',
              email: 'user@example.com',
              userName: 'User One',
              isLockedOut: false,
              roles: ['AdminStore'],
              tenantId: 'tenant-1',
              storeId: 'store-1',
            }),
            setUserLockState: async () => ({
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
            ],
          },
        },
        { provide: AuthService, useValue: authMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UsersAdminPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('SuperAdmin should show tenant and store filters', async () => {
    authMock = {
      hasRole: (role: string) => role === 'SuperAdmin',
      getTenantId: () => null,
      getStoreId: () => null,
    };

    await createComponent();

    const nativeElement = fixture.nativeElement as HTMLElement;
    expect(nativeElement.querySelector('[data-testid="admin-users-filter-tenant"]')).toBeTruthy();
    expect(nativeElement.querySelector('[data-testid="admin-users-filter-store"]')).toBeTruthy();
  });

  it('TenantAdmin should render tenant filter disabled and store enabled', async () => {
    authMock = {
      hasRole: (role: string) => role === 'TenantAdmin',
      getTenantId: () => 'tenant-1',
      getStoreId: () => null,
    };

    await createComponent();

    const nativeElement = fixture.nativeElement as HTMLElement;
    const tenant = nativeElement.querySelector(
      '[data-testid="admin-users-filter-tenant"]',
    ) as HTMLInputElement;
    const store = nativeElement.querySelector(
      '[data-testid="admin-users-filter-store"]',
    ) as HTMLInputElement;
    expect(tenant.disabled).toBe(true);
    expect(store.disabled).toBe(false);
  });

  it('AdminStore should keep store filter disabled (fixed scope)', async () => {
    authMock = {
      hasRole: (role: string) => role === 'AdminStore',
      getTenantId: () => 'tenant-1',
      getStoreId: () => 'store-1',
    };

    await createComponent();

    const nativeElement = fixture.nativeElement as HTMLElement;
    expect(nativeElement.querySelector('[data-testid="admin-users-filter-tenant"]')).toBeFalsy();
    const store = nativeElement.querySelector(
      '[data-testid="admin-users-filter-store"]',
    ) as HTMLInputElement;
    expect(store.disabled).toBe(true);
  });

  it('role changes should recalculate store required message', async () => {
    authMock = {
      hasRole: (role: string) => role === 'SuperAdmin',
      getTenantId: () => null,
      getStoreId: () => null,
    };

    await createComponent();

    const component = fixture.componentInstance;
    component.roleDraftControl('user-1').setValue('Cashier');
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="admin-user-form-store-required"]',
      ),
    ).toBeTruthy();

    component.roleDraftControl('user-1').setValue('TenantAdmin');
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="admin-user-form-store-required"]',
      ),
    ).toBeFalsy();
  });

  it('should render success and validation errors with stable testids', async () => {
    authMock = {
      hasRole: (role: string) => role === 'SuperAdmin',
      getTenantId: () => null,
      getStoreId: () => null,
    };

    await createComponent();

    const component = fixture.componentInstance;
    component.successMessage.set('Rol actualizado correctamente.');
    component.errorMessage.set('StoreId es obligatorio para asignar ese rol.');
    fixture.detectChanges();

    const nativeElement = fixture.nativeElement as HTMLElement;
    expect(
      nativeElement.querySelector('[data-testid="admin-user-form-success"]')?.textContent,
    ).toContain('Rol actualizado');
    expect(
      nativeElement.querySelector('[data-testid="admin-user-form-error"]')?.textContent,
    ).toContain('StoreId es obligatorio');
  });
});
