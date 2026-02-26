import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UsersAdminPage } from './users-admin.page';
import { AdminUsersService } from '../../services/admin-users.service';
import { AdminRolesService } from '../../services/admin-roles.service';

describe('UsersAdminPage', () => {
  let fixture: ComponentFixture<UsersAdminPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsersAdminPage],
      providers: [
        {
          provide: AdminUsersService,
          useValue: {
            getUsers: async () => ({
              items: [],
              totalCount: 0,
              pageNumber: 1,
              pageSize: 10,
            }),
            updateUserRoles: async () => ({
              id: '1',
              email: 'user@example.com',
              fullName: 'User',
              isLocked: false,
              roles: ['AdminStore'],
            }),
            setUserLockState: async () => ({
              id: '1',
              email: 'user@example.com',
              fullName: 'User',
              isLocked: true,
              roles: ['AdminStore'],
            }),
          },
        },
        {
          provide: AdminRolesService,
          useValue: {
            getRoles: async () => [],
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UsersAdminPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should render basic admin users shell', () => {
    expect(fixture.componentInstance).toBeTruthy();
    const nativeElement = fixture.nativeElement as HTMLElement;
    expect(nativeElement.textContent).toContain('Administración de usuarios');
  });
});
