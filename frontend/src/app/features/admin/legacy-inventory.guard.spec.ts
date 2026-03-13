import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlSegment } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/services/auth.service';
import { legacyInventoryGuard } from './legacy-inventory.guard';

describe('legacyInventoryGuard', () => {
  const originalLegacyFlag = environment.legacyInventoryEnabled;

  afterEach(() => {
    environment.legacyInventoryEnabled = originalLegacyFlag;
  });

  it('allows legacy route when legacyInventoryEnabled is true', () => {
    environment.legacyInventoryEnabled = true;

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: () => true,
            hasRole: () => false,
          },
        },
      ],
    });

    const result = TestBed.runInInjectionContext(() =>
      legacyInventoryGuard({ path: 'pos/inventory-legacy' }, [] as UrlSegment[]),
    );

    expect(result).toBe(true);
  });

  it('allows legacy route for SuperAdmin even with disabled flag', () => {
    environment.legacyInventoryEnabled = false;

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: () => true,
            hasRole: (role: string) => role === 'SuperAdmin',
          },
        },
      ],
    });

    const result = TestBed.runInInjectionContext(() =>
      legacyInventoryGuard({ path: 'pos/inventory-legacy' }, [] as UrlSegment[]),
    );

    expect(result).toBe(true);
  });

  it('blocks legacy route for non-authorized roles', () => {
    environment.legacyInventoryEnabled = false;

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: () => true,
            hasRole: () => false,
          },
        },
      ],
    });

    const router = TestBed.inject(Router);
    const result = TestBed.runInInjectionContext(() =>
      legacyInventoryGuard({ path: 'pos/inventory-legacy' }, [] as UrlSegment[]),
    );

    expect(result).toEqual(router.createUrlTree(['/app/dashboard']));
  });
});
