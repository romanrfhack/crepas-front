import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, shareReplay, switchMap, throwError } from 'rxjs';
import { AuthService } from '../../features/auth/services/auth.service';
import { AuthTokensResponse } from '../../features/auth/models/auth.models';

const AUTH_PATHS = ['/v1/auth/login', '/v1/auth/register', '/v1/auth/refresh'];

let refreshRequest$: Observable<AuthTokensResponse> | null = null;

export const refreshTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const shouldSkip = AUTH_PATHS.some((path) => req.url.includes(path));
  if (shouldSkip) {
    return next(req);
  }

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      const refreshToken = authService.getRefreshToken();
      if (!refreshToken) {
        authService.logout();
        router.navigate(['/login']);
        return throwError(() => error);
      }

      if (!refreshRequest$) {
        refreshRequest$ = authService.refresh({ refreshToken }).pipe(
          shareReplay(1),
          finalize(() => {
            refreshRequest$ = null;
          }),
        );
      }

      return refreshRequest$.pipe(
        switchMap(() => {
          const accessToken = authService.getAccessToken();
          if (!accessToken) {
            authService.logout();
            router.navigate(['/login']);
            return throwError(() => error);
          }

          const authReq = req.clone({
            setHeaders: { Authorization: `Bearer ${accessToken}` },
          });
          return next(authReq);
        }),
        catchError((refreshError: unknown) => {
          authService.logout();
          router.navigate(['/login']);
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
