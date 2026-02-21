import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../../core/services/api-client';
import {
  AssignTenantCatalogTemplateRequest,
  CatalogTemplateDto,
  UpsertCatalogTemplateRequest,
} from '../models/platform.models';

@Injectable({ providedIn: 'root' })
export class PlatformCatalogTemplatesApiService {
  private readonly apiClient = inject(ApiClient);
  private readonly basePath = '/v1/platform/catalog-templates';

  listTemplates(verticalId?: string) {
    const query = verticalId ? `?verticalId=${encodeURIComponent(verticalId)}` : '';
    return firstValueFrom(this.apiClient.get<CatalogTemplateDto[]>(`${this.basePath}${query}`));
  }

  createTemplate(payload: UpsertCatalogTemplateRequest) {
    return firstValueFrom(this.apiClient.post<CatalogTemplateDto>(this.basePath, payload));
  }

  updateTemplate(id: string, payload: UpsertCatalogTemplateRequest) {
    return firstValueFrom(this.apiClient.put<CatalogTemplateDto>(`${this.basePath}/${id}`, payload));
  }

  assignTemplateToTenant(tenantId: string, payload: AssignTenantCatalogTemplateRequest) {
    return firstValueFrom(this.apiClient.put<void>(`${this.basePath}/tenants/${tenantId}`, payload));
  }
}
