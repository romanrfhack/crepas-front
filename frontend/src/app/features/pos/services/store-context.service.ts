import { Injectable, signal } from '@angular/core';

const ACTIVE_STORE_KEY = 'pos_active_store_id';

@Injectable({ providedIn: 'root' })
export class StoreContextService {
  private readonly activeStoreIdState = signal<string | null>(this.readStoreId());

  readonly activeStoreId = this.activeStoreIdState.asReadonly();

  getActiveStoreId(): string | null {
    return this.activeStoreIdState();
  }

  setActiveStoreId(id: string | null): void {
    const normalized = id?.trim() ?? '';
    const nextStoreId = normalized.length > 0 ? normalized : null;
    this.activeStoreIdState.set(nextStoreId);

    if (nextStoreId) {
      localStorage.setItem(ACTIVE_STORE_KEY, nextStoreId);
      return;
    }

    localStorage.removeItem(ACTIVE_STORE_KEY);
  }

  private readStoreId(): string | null {
    const fromStorage = localStorage.getItem(ACTIVE_STORE_KEY)?.trim();
    if (fromStorage) {
      return fromStorage;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      return null;
    }

    const payload = this.parseTokenPayload(token);
    if (!payload) {
      return null;
    }

    const candidates = [
      payload['storeId'],
      payload['store_id'],
      payload['pos_store_id'],
      payload['default_store_id'],
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }

    return null;
  }

  private parseTokenPayload(token: string): Record<string, unknown> | null {
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
}
