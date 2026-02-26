import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlSegment } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';
import { AuthService } from '../auth/services/auth.service';
import { adminRoutes } from './admin.routes';

describe('adminRoutes', () => {
  it('should include lazy POS catalog route protected for Admin and Manager roles', () => {
    const route = adminRoutes.find((item) => item.path === 'pos/catalog');
    expect(route).toBeDefined();
    expect(route?.loadChildren).toBeDefined();
    expect(route?.data?.['roles']).toEqual(['AdminStore', 'Admin', 'Manager', 'TenantAdmin', 'SuperAdmin']);
    expect(route?.canMatch?.length).toBeGreaterThan(0);
    expect(route?.canActivate?.length).toBeGreaterThan(0);
  });

  it('should block access to admin route for non-admin users', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: () => true,
            hasAnyRole: () => false,
          },
        },
      ],
    });

    const router = TestBed.inject(Router);
    const route = { path: 'pos/catalog', data: { roles: ['AdminStore', 'Admin', 'Manager', 'TenantAdmin', 'SuperAdmin'] } };
    const segments: UrlSegment[] = [];

    const result = TestBed.runInInjectionContext(() => roleGuard([])(route, segments));

    expect(result).toEqual(router.createUrlTree(['/app/dashboard']));
  });
});
