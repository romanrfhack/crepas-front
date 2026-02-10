import { TestBed } from '@angular/core/testing';
import { provideRouter, Route, Router, UrlSegment } from '@angular/router';
import { AuthService } from '../../features/auth/services/auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  it('should redirect to /login when user is not authenticated', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: () => false,
          },
        },
      ],
    });

    const router = TestBed.inject(Router);
    const route = { path: 'app' } as Route;
    const segments: UrlSegment[] = [];
    const result = TestBed.runInInjectionContext(() => authGuard(route, segments));

    expect(result).toEqual(router.createUrlTree(['/login']));
  });

  it('should allow access when user is authenticated', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: () => true,
          },
        },
      ],
    });

    const route = { path: 'app' } as Route;
    const segments: UrlSegment[] = [];
    const result = TestBed.runInInjectionContext(() => authGuard(route, segments));

    expect(result).toBe(true);
  });
});
