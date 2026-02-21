import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../../../core/services/api-client';

export type CatalogItemType = 'Product' | 'Extra' | 'OptionItem';

export interface CatalogItemOverrideDto {
  itemType: string;
  itemId: string;
  isEnabled: boolean;
  updatedAtUtc: string;
}

export interface UpsertCatalogItemOverrideRequest {
  itemType: CatalogItemType;
  itemId: string;
  isEnabled: boolean;
}

@Injectable({ providedIn: 'root' })
export class PosAdminCatalogOverridesApiService {
  private readonly apiClient = inject(ApiClient);
  private readonly path = '/v1/pos/admin/catalog/overrides';

  listOverrides(type?: string) {
    const query = type ? `?type=${encodeURIComponent(type)}` : '';
    return firstValueFrom(this.apiClient.get<CatalogItemOverrideDto[]>(`${this.path}${query}`));
  }

  upsertOverride(payload: UpsertCatalogItemOverrideRequest) {
    return firstValueFrom(this.apiClient.put<CatalogItemOverrideDto>(this.path, payload));
  }
}
