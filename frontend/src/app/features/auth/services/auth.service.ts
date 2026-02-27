import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { ApiClient } from '../../../core/services/api-client';
import {
  AuthLoginRequest,
  AuthRefreshRequest,
  AuthRegisterRequest,
  AuthTokens,
  AuthTokensResponse,
} from '../models/auth.models';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const DEFAULT_POST_LOGIN_ROUTE = '/app/dashboard';
const CASHIER_POST_LOGIN_ROUTE = '/app/pos/caja';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiClient = inject(ApiClient);
  private readonly router = inject(Router);
  private readonly accessToken = signal<string | null>(localStorage.getItem(ACCESS_TOKEN_KEY));
  private readonly refreshToken = signal<string | null>(localStorage.getItem(REFRESH_TOKEN_KEY));
  private readonly parsedJwtPayload = computed(() => this.parseTokenPayload(this.accessToken()));
  readonly authenticated = computed(() => Boolean(this.accessToken()));
  readonly isAuthenticatedSig = computed(() => this.authenticated());
  readonly rolesSig = computed(() => this.extractRoles(this.parsedJwtPayload()));
  readonly sessionScopeSig = computed(() => this.extractSessionScope(this.parsedJwtPayload()));

  login(payload: AuthLoginRequest) {
    return this.apiClient
      .post<AuthTokensResponse>('/v1/auth/login', payload)
      .pipe(tap((response) => this.storeTokens(this.normalizeTokens(response))));
  }

  loginAndRedirect(payload: AuthLoginRequest, returnUrl?: string | null) {
    return this.login(payload).pipe(
      tap(() => {
        const targetUrl = this.resolvePostLoginUrl(returnUrl);
        void this.router.navigateByUrl(targetUrl);
      }),
    );
  }

  register(payload: AuthRegisterRequest) {
    return this.apiClient
      .post<AuthTokensResponse>('/v1/auth/register', payload)
      .pipe(tap((response) => this.storeTokens(this.normalizeTokens(response))));
  }

  refresh(payload: AuthRefreshRequest) {
    return this.apiClient
      .post<AuthTokensResponse>('/v1/auth/refresh', payload)
      .pipe(tap((response) => this.storeTokens(this.normalizeTokens(response))));
  }

  logout() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    this.accessToken.set(null);
    this.refreshToken.set(null);
  }

  isAuthenticated() {
    return this.authenticated();
  }

  getAccessToken() {
    return this.accessToken();
  }

  getRefreshToken() {
    return this.refreshToken();
  }

  hasRole(role: string) {
    const normalizedRole = role.trim().toLowerCase();
    if (!normalizedRole) {
      return false;
    }

    return this.rolesSig().some((currentRole) => currentRole.toLowerCase() === normalizedRole);
  }

  hasAnyRole(roles: readonly string[]) {
    return roles.some((role) => this.hasRole(role));
  }

  getTenantId() {
    return this.extractGuidClaim(this.parsedJwtPayload(), ['tenantId']);
  }

  getStoreId() {
    return this.extractGuidClaim(this.parsedJwtPayload(), ['storeId']);
  }

  resolvePostLoginUrl(returnUrl?: string | null) {
    if (this.hasRole('Cashier')) {
      return CASHIER_POST_LOGIN_ROUTE;
    }

    if (
      this.hasRole('AdminStore') ||
      this.hasRole('Manager') ||
      this.hasRole('TenantAdmin') ||
      this.hasRole('SuperAdmin')
    ) {
      const normalizedReturnUrl = this.normalizeReturnUrl(returnUrl);
      if (normalizedReturnUrl) {
        return normalizedReturnUrl;
      }
    }

    return DEFAULT_POST_LOGIN_ROUTE;
  }

  private storeTokens(tokens: AuthTokens) {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    this.accessToken.set(tokens.accessToken);
    this.refreshToken.set(tokens.refreshToken);
  }

  private normalizeTokens(response: AuthTokensResponse): AuthTokens {
    return {
      accessToken: response.accessToken ?? response.access_token ?? '',
      refreshToken: response.refreshToken ?? response.refresh_token ?? '',
    };
  }

  private parseTokenPayload(token: string | null): Record<string, unknown> | null {
    if (!token) {
      return null;
    }

    const tokenParts = token.split('.');
    const payload = tokenParts[1];
    if (!payload) {
      return null;
    }

    try {
      const decodedPayload = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decodedPayload) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private extractRoles(payload: Record<string, unknown> | null): string[] {
    const roleClaimUris = [
      'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role',
    ];

    const candidates = [
      payload?.['roles'],
      payload?.['role'],
      ...roleClaimUris.map((key) => payload?.[key]),
    ];

    const roles = candidates.flatMap((value) => {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') return [value];
      return [];
    });

    return Array.from(
      new Set(roles.map((role) => String(role).trim()).filter((role) => role.length > 0)),
    );
  }

  private extractSessionScope(payload: Record<string, unknown> | null): string {
    const sessionCandidateKeys = ['email', 'preferred_username', 'upn', 'sub'];
    const sessionCandidate = sessionCandidateKeys
      .map((key) => payload?.[key])
      .find((value): value is string => typeof value === 'string' && value.trim().length > 0);

    return sessionCandidate?.trim().toLowerCase() ?? 'anonymous';
  }

  private extractGuidClaim(payload: Record<string, unknown> | null, keys: readonly string[]) {
    for (const key of keys) {
      const value = payload?.[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }

    return null;
  }

  private normalizeReturnUrl(returnUrl?: string | null): string | null {
    if (!returnUrl) {
      return null;
    }

    const normalizedValue = returnUrl.trim();
    if (!normalizedValue.startsWith('/')) {
      return null;
    }

    if (!normalizedValue.startsWith('/app')) {
      return null;
    }

    return normalizedValue;
  }
}
