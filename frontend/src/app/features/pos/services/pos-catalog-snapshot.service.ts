import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../../core/services/api-client';
import { CatalogSnapshotDto } from '../models/pos.models';

@Injectable({ providedIn: 'root' })
export class PosCatalogSnapshotService {
  private readonly apiClient = inject(ApiClient);
  private readonly path = '/v1/pos/catalog/snapshot';
  private readonly cachedSnapshot = signal<CatalogSnapshotDto | null>(null);

  readonly snapshot = this.cachedSnapshot.asReadonly();

  async getSnapshot(forceRefresh = false) {
    if (!forceRefresh && this.cachedSnapshot()) {
      return this.cachedSnapshot() as CatalogSnapshotDto;
    }

    const snapshot = await firstValueFrom(this.apiClient.get<CatalogSnapshotDto>(this.path));
    this.cachedSnapshot.set(snapshot);
    return snapshot;
  }

  clearCache() {
    this.cachedSnapshot.set(null);
  }
}
