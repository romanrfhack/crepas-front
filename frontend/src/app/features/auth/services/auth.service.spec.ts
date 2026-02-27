import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiClient } from '../../../core/services/api-client';
import { AuthService } from './auth.service';

const createToken = (payload: Record<string, unknown>) => {
  const encodedPayload = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `header.${encodedPayload}.signature`;
};

const setupAuthService = () => {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: ApiClient,
        useValue: {
          post: () =>
            of({
              accessToken: createToken({ roles: ['AdminStore'] }),
              refreshToken: 'refresh-token',
            }),
        },
      },
    ],
  });

  return TestBed.inject(AuthService);
};

describe('AuthService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should prioritize cashier route over returnUrl', () => {
    localStorage.setItem('access_token', createToken({ roles: ['Cashier', 'AdminStore'] }));
    const service = setupAuthService();

    expect(service.resolvePostLoginUrl('/app/admin/users')).toBe('/app/pos/caja');
  });

  it('should respect returnUrl for admin-store users', () => {
    localStorage.setItem('access_token', createToken({ roles: ['AdminStore'] }));
    const service = setupAuthService();

    expect(service.resolvePostLoginUrl('/app/admin/users')).toBe('/app/admin/users');
  });

  it('should fallback to dashboard when returnUrl is invalid', () => {
    localStorage.setItem('access_token', createToken({ roles: ['AdminStore'] }));
    const service = setupAuthService();

    expect(service.resolvePostLoginUrl('https://evil.local')).toBe('/app/dashboard');
  });
});
