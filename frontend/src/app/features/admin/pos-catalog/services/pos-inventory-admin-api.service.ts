import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../../../core/services/api-client';
import {
  CatalogItemType,
  CatalogInventoryItemDto,
  PosInventorySettingsDto,
  StoreInventoryItemDto,
  UpsertCatalogInventoryRequest,
  UpsertStoreInventoryRequest,
} from '../models/pos-catalog.models';

@Injectable({ providedIn: 'root' })
export class PosInventoryAdminApiService {
  private readonly apiClient = inject(ApiClient);
  private readonly releaseCPath = '/v1/pos/admin/catalog/inventory';
  private readonly legacyPath = '/v1/pos/admin/inventory';

  listInventory(storeId: string, itemType?: CatalogItemType, itemId?: string, onlyTracked?: boolean) {
    const query = new URLSearchParams({ storeId });
    if (itemType?.trim()) {
      query.set('itemType', itemType.trim());
    }

    if (itemId?.trim()) {
      query.set('itemId', itemId.trim());
    }

    if (onlyTracked) {
      query.set('onlyTracked', 'true');
    }

    return firstValueFrom(this.apiClient.get<CatalogInventoryItemDto[]>(`${this.releaseCPath}?${query.toString()}`));
  }

  upsertInventory(payload: UpsertCatalogInventoryRequest) {
    return firstValueFrom(this.apiClient.put<CatalogInventoryItemDto>(this.releaseCPath, payload));
  }

  listLegacyInventory(storeId: string, search?: string, onlyWithStock?: boolean) {
    const query = new URLSearchParams({ storeId });
    if (search?.trim()) {
      query.set('search', search.trim());
    }

    if (onlyWithStock) {
      query.set('onlyWithStock', 'true');
    }

    return firstValueFrom(this.apiClient.get<StoreInventoryItemDto[]>(`${this.legacyPath}?${query.toString()}`));
  }

  upsertLegacyInventory(payload: UpsertStoreInventoryRequest) {
    return firstValueFrom(this.apiClient.put<StoreInventoryItemDto>(this.legacyPath, payload));
  }

  updateInventorySettings(payload: PosInventorySettingsDto) {
    return firstValueFrom(this.apiClient.put<PosInventorySettingsDto>(`${this.legacyPath}/settings`, payload));
  }
}
