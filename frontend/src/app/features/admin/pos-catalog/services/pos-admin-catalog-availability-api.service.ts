import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../../../core/services/api-client';
import { CatalogItemType } from './pos-admin-catalog-overrides-api.service';

export interface CatalogStoreAvailabilityDto {
  storeId: string;
  itemType: string;
  itemId: string;
  isAvailable: boolean;
  updatedAtUtc: string;
}

export interface UpsertCatalogStoreAvailabilityRequest {
  storeId: string;
  itemType: CatalogItemType;
  itemId: string;
  isAvailable: boolean;
}

@Injectable({ providedIn: 'root' })
export class PosAdminCatalogAvailabilityApiService {
  private readonly apiClient = inject(ApiClient);
  private readonly path = '/v1/pos/admin/catalog/availability';

  upsertAvailability(payload: UpsertCatalogStoreAvailabilityRequest) {
    return firstValueFrom(this.apiClient.put<CatalogStoreAvailabilityDto>(this.path, payload));
  }
}
