import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../features/auth/services/auth.service';
import { refreshTokenInterceptor } from './refresh-token.interceptor';

describe('refreshTokenInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;

  const authService = {
    getRefreshToken: vi.fn<() => string | null>(),
    refresh: vi.fn(),
    getAccessToken: vi.fn<() => string | null>(),
    logout: vi.fn<() => void>(),
  };

  const router = {
    navigate: vi.fn<(commands: unknown[]) => Promise<boolean>>(),
  };

  beforeEach(() => {
    authService.getRefreshToken.mockReset();
    authService.refresh.mockReset();
    authService.getAccessToken.mockReset();
    authService.logout.mockReset();

    router.navigate.mockReset();
    router.navigate.mockResolvedValue(true);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([refreshTokenInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('logs out and navigates to login when there is no refresh token, completing without error', () => {
    authService.getRefreshToken.mockReturnValue(null);

    let completed = false;
    let handledError: unknown;

    httpClient.get('/api/v1/admin/users').subscribe({
      complete: () => {
        completed = true;
      },
      error: (error: unknown) => {
        handledError = error;
      },
    });

    const request = httpMock.expectOne('/api/v1/admin/users');
    request.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(authService.logout).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    expect(completed).toBe(true);
    expect(handledError).toBeUndefined();
  });

  it('logs out and navigates to login when refresh fails, completing without error', () => {
    authService.getRefreshToken.mockReturnValue('refresh-token');
    authService.refresh.mockReturnValue(throwError(() => new Error('refresh failed')));

    let completed = false;
    let handledError: unknown;

    httpClient.get('/api/v1/admin/users').subscribe({
      complete: () => {
        completed = true;
      },
      error: (error: unknown) => {
        handledError = error;
      },
    });

    const request = httpMock.expectOne('/api/v1/admin/users');
    request.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(authService.refresh).toHaveBeenCalledWith({ refreshToken: 'refresh-token' });
    expect(authService.logout).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    expect(completed).toBe(true);
    expect(handledError).toBeUndefined();
  });

  it('retries request with renewed access token when refresh succeeds', () => {
    authService.getRefreshToken.mockReturnValue('refresh-token');
    authService.refresh.mockReturnValue(of({ accessToken: 'new-token', refreshToken: 'new-refresh' }));
    authService.getAccessToken.mockReturnValue('new-token');

    httpClient.get('/api/v1/admin/users').subscribe();

    const protectedRequest = httpMock.expectOne('/api/v1/admin/users');
    protectedRequest.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    const retriedRequest = httpMock.expectOne('/api/v1/admin/users');
    expect(retriedRequest.request.headers.get('Authorization')).toBe('Bearer new-token');
    retriedRequest.flush({ ok: true });

    expect(authService.logout).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
