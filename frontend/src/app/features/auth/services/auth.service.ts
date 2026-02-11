import { Injectable, computed, signal, inject } from '@angular/core';
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

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiClient = inject(ApiClient);
  private readonly accessToken = signal<string | null>(localStorage.getItem(ACCESS_TOKEN_KEY));
  private readonly refreshToken = signal<string | null>(localStorage.getItem(REFRESH_TOKEN_KEY));
  private readonly parsedJwtPayload = computed(() => this.parseTokenPayload(this.accessToken()));
  readonly authenticated = computed(() => Boolean(this.accessToken()));
  readonly isAuthenticatedSig = computed(() => this.authenticated());
  readonly rolesSig = computed(() => this.extractRoles(this.parsedJwtPayload()));

  login(payload: AuthLoginRequest) {
    return this.apiClient
      .post<AuthTokensResponse>('/v1/auth/login', payload)
      .pipe(tap((response) => this.storeTokens(this.normalizeTokens(response))));
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
    if (!payload) {
      return [];
    }

    const directRoles = this.normalizeRolesClaim(payload['roles']);
    if (directRoles.length > 0) {
      return directRoles;
    }

    return this.normalizeRolesClaim(payload['role']);
  }

  private normalizeRolesClaim(claim: unknown): string[] {
    if (typeof claim === 'string') {
      return [claim];
    }

    if (Array.isArray(claim)) {
      return claim.filter((value): value is string => typeof value === 'string');
    }

    return [];
  }
}
