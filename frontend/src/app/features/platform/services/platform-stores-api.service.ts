import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../../core/services/api-client';
import {
  PlatformStoreDetailsDto,
  PlatformTenantStoreListItemDto,
  UpdatePlatformStoreRequestDto,
  UpdateTenantDefaultStoreRequestDto,
} from '../models/platform.models';

@Injectable({ providedIn: 'root' })
export class PlatformStoresApiService {
  private readonly apiClient = inject(ApiClient);
  private readonly basePath = '/v1/platform';

  getTenantStores(tenantId: string) {
    return firstValueFrom(
      this.apiClient.get<PlatformTenantStoreListItemDto[]>(`${this.basePath}/tenants/${tenantId}/stores`),
    );
  }

  getStoreDetails(storeId: string) {
    return firstValueFrom(this.apiClient.get<PlatformStoreDetailsDto>(`${this.basePath}/stores/${storeId}`));
  }

  updateStore(storeId: string, payload: UpdatePlatformStoreRequestDto) {
    return firstValueFrom(
      this.apiClient.put<PlatformStoreDetailsDto>(`${this.basePath}/stores/${storeId}`, payload),
    );
  }

  updateTenantDefaultStore(tenantId: string, payload: UpdateTenantDefaultStoreRequestDto) {
    return firstValueFrom(
      this.apiClient.put<void>(`${this.basePath}/tenants/${tenantId}/default-store`, payload),
    );
  }
}
