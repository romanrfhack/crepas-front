import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../../core/services/api-client';
import {
  CreatePlatformTenantRequest,
  PlatformTenantDetailsDto,
  PlatformTenantDto,
  UpdatePlatformTenantRequest,
  UpdatePlatformTenantRequestDto,
} from '../models/platform.models';

@Injectable({ providedIn: 'root' })
export class PlatformTenantsApiService {
  private readonly apiClient = inject(ApiClient);
  private readonly basePath = '/v1/platform/tenants';

  listTenants() {
    return firstValueFrom(this.apiClient.get<PlatformTenantDto[]>(this.basePath));
  }

  getTenantDetails(tenantId: string) {
    return firstValueFrom(
      this.apiClient.get<PlatformTenantDetailsDto>(`${this.basePath}/${tenantId}`),
    );
  }

  createTenant(payload: CreatePlatformTenantRequest) {
    return firstValueFrom(this.apiClient.post<PlatformTenantDto>(this.basePath, payload));
  }

  updateTenant(id: string, payload: UpdatePlatformTenantRequest) {
    return firstValueFrom(this.apiClient.put<PlatformTenantDto>(`${this.basePath}/${id}`, payload));
  }

  updateTenantDetails(tenantId: string, payload: UpdatePlatformTenantRequestDto) {
    return firstValueFrom(
      this.apiClient.put<PlatformTenantDetailsDto>(`${this.basePath}/${tenantId}`, payload),
    );
  }

  deleteTenant(id: string) {
    return firstValueFrom(this.apiClient.delete<void>(`${this.basePath}/${id}`));
  }
}
