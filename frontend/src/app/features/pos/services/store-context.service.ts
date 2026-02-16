import { Injectable } from '@angular/core';

const ACTIVE_STORE_KEY = 'pos_active_store_id';

@Injectable({ providedIn: 'root' })
export class StoreContextService {
  private activeStoreId: string | null = this.readStoreId();

  getActiveStoreId(): string | null {
    return this.activeStoreId;
  }

  setActiveStoreId(id: string | null): void {
    const normalized = id?.trim() ?? '';
    this.activeStoreId = normalized.length > 0 ? normalized : null;

    if (this.activeStoreId) {
      localStorage.setItem(ACTIVE_STORE_KEY, this.activeStoreId);
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
