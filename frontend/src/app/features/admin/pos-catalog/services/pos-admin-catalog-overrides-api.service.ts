import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../../../core/services/api-client';

export type CatalogItemType = 'Product' | 'Extra' | 'OptionItem';

export interface CatalogItemOverrideDto {
  storeId: string;
  itemType: string;
  itemId: string;
  state: 'Enabled' | 'Disabled';
  updatedAtUtc: string;
}

export interface UpsertCatalogStoreOverrideRequest {
  storeId: string;
  itemType: CatalogItemType;
  itemId: string;
  state: 'Enabled' | 'Disabled';
}

@Injectable({ providedIn: 'root' })
export class PosAdminCatalogOverridesApiService {
  private readonly apiClient = inject(ApiClient);
  private readonly path = '/v1/pos/admin/catalog/store-overrides';

  listOverrides(storeId: string, itemType?: string, onlyOverrides = true) {
    const query = new URLSearchParams({ storeId, onlyOverrides: String(onlyOverrides) });
    if (itemType?.trim()) {
      query.set('itemType', itemType.trim());
    }

    return firstValueFrom(this.apiClient.get<CatalogItemOverrideDto[]>(`${this.path}?${query.toString()}`));
  }

  upsertOverride(payload: UpsertCatalogStoreOverrideRequest) {
    return firstValueFrom(this.apiClient.put<CatalogItemOverrideDto>(this.path, payload));
  }

  deleteOverride(storeId: string, itemType: CatalogItemType, itemId: string) {
    const query = new URLSearchParams({ storeId, itemType, itemId });
    return firstValueFrom(this.apiClient.delete<void>(`${this.path}?${query.toString()}`));
  }
}
