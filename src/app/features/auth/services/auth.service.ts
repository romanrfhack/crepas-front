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
  readonly authenticated = computed(() => Boolean(this.accessToken()));
  readonly isAuthenticatedSig = computed(() => this.authenticated());

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
}
