import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../../../core/services/api-client';
import {
  PosInventorySettingsDto,
  StoreInventoryItemDto,
  UpsertStoreInventoryRequest,
} from '../models/pos-catalog.models';

@Injectable({ providedIn: 'root' })
export class PosInventoryAdminApiService {
  private readonly apiClient = inject(ApiClient);
  private readonly path = '/v1/pos/admin/inventory';

  listInventory(storeId: string, search?: string, onlyWithStock?: boolean) {
    const query = new URLSearchParams({ storeId });
    if (search?.trim()) {
      query.set('search', search.trim());
    }

    if (onlyWithStock) {
      query.set('onlyWithStock', 'true');
    }

    return firstValueFrom(this.apiClient.get<StoreInventoryItemDto[]>(`${this.path}?${query.toString()}`));
  }

  upsertInventory(payload: UpsertStoreInventoryRequest) {
    return firstValueFrom(this.apiClient.put<StoreInventoryItemDto>(this.path, payload));
  }

  updateInventorySettings(payload: PosInventorySettingsDto) {
    return firstValueFrom(this.apiClient.put<PosInventorySettingsDto>(`${this.path}/settings`, payload));
  }
}
