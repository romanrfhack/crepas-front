import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlSegment } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';
import { AuthService } from '../auth/services/auth.service';
import { appShellRoutes } from './app-shell.routes';

describe('appShellRoutes', () => {
  it('should include pos lazy route protected for Admin/Cashier/Manager', () => {
    const shell = appShellRoutes[0];
    const posRoute = shell?.children?.find((route) => route.path === 'pos');

    expect(posRoute).toBeDefined();
    expect(posRoute?.loadChildren).toBeDefined();
    expect(posRoute?.data?.['roles']).toEqual(['Admin', 'Cashier', 'Manager']);
  });

  it('should block pos route for users without Admin/Cashier roles', () => {
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
    const route = { path: 'pos', data: { roles: ['Admin', 'Cashier'] } };
    const segments: UrlSegment[] = [];

    const result = TestBed.runInInjectionContext(() => roleGuard([])(route, segments));

    expect(result).toEqual(router.createUrlTree(['/app/dashboard']));
  });
});
