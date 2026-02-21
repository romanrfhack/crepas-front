export interface CatalogTemplateDto {
  id: string;
  verticalId: string;
  name: string;
  version: string | null;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface UpsertCatalogTemplateRequest {
  verticalId: string;
  name: string;
  version: string | null;
  isActive?: boolean;
}

export interface AssignTenantCatalogTemplateRequest {
  catalogTemplateId: string;
}
