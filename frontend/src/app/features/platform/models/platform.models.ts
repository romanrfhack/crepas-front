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

export interface PlatformVerticalDto {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface UpsertPlatformVerticalRequest {
  name: string;
  description: string | null;
}

export interface PlatformTenantDto {
  id: string;
  verticalId: string;
  name: string;
  slug: string;
  isActive: boolean;
  defaultStoreId: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface CreatePlatformTenantRequest {
  verticalId: string;
  name: string;
  slug: string;
  timeZoneId?: string;
}

export interface UpdatePlatformTenantRequest {
  verticalId: string;
  name: string;
  slug: string;
}
