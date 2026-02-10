import { TestBed } from '@angular/core/testing';
import { provideRouter, Route, Router, UrlSegment } from '@angular/router';
import { AuthService } from '../../features/auth/services/auth.service';
import { roleGuard } from './role.guard';

describe('roleGuard', () => {
  const route = { path: 'admin' } as Route;
  const segments: UrlSegment[] = [];

  it('should redirect to /login when no token is available', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: () => false,
            hasAnyRole: () => false,
          },
        },
      ],
    });

    const router = TestBed.inject(Router);
    const result = TestBed.runInInjectionContext(() => roleGuard(['Admin'])(route, segments));

    expect(result).toEqual(router.createUrlTree(['/login']));
  });

  it('should redirect to /app/dashboard when user has no Admin role', () => {
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
    const result = TestBed.runInInjectionContext(() => roleGuard(['Admin'])(route, segments));

    expect(result).toEqual(router.createUrlTree(['/app/dashboard']));
  });

  it('should allow access when user has Admin role', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: () => true,
            hasAnyRole: () => true,
          },
        },
      ],
    });

    const result = TestBed.runInInjectionContext(() => roleGuard(['Admin'])(route, segments));

    expect(result).toBe(true);
  });
});
