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

export interface PlatformSummaryQuery {
  dateFrom?: string;
  dateTo?: string;
  threshold?: number;
}

export interface PlatformDashboardSummaryDto {
  activeTenants: number;
  inactiveTenants: number;
  activeStores: number;
  inactiveStores: number;
  totalUsers: number;
  usersWithoutStoreAssignment: number;
  tenantsWithoutCatalogTemplate: number;
  storesWithoutAdminStore: number;
  salesTodayCount: number;
  salesTodayAmount: number;
  salesLast7DaysCount: number;
  salesLast7DaysAmount: number;
  openShiftsCount: number;
  outOfStockItemsCount: number;
  lowStockItemsCount: number;
  effectiveDateFromUtc: string;
  effectiveDateToUtc: string;
  effectiveLowStockThreshold: number;
}

export interface PlatformTopTenantsQuery {
  dateFrom?: string;
  dateTo?: string;
  top?: number;
  includeInactive?: boolean;
}

export interface PlatformTopTenantRowDto {
  tenantId: string;
  tenantName: string;
  verticalId: string;
  verticalName: string;
  storeCount: number;
  salesCount: number;
  salesAmount: number;
  averageTicket: number;
  voidedSalesCount: number;
}

export interface PlatformTopTenantsResponseDto {
  items: PlatformTopTenantRowDto[];
  effectiveDateFromUtc: string;
  effectiveDateToUtc: string;
  top: number;
  includeInactive: boolean;
}

export interface PlatformDashboardAlertDto {
  code: string;
  severity: string;
  count: number;
  description: string;
  topExamples: string[];
}

export interface PlatformDashboardAlertsResponseDto {
  alerts: PlatformDashboardAlertDto[];
}

export interface PlatformRecentInventoryAdjustmentsQuery {
  take?: number;
  reason?: string;
  tenantId?: string;
  storeId?: string;
}

export interface PlatformRecentInventoryAdjustmentDto {
  adjustmentId: string;
  tenantId: string;
  tenantName: string;
  storeId: string;
  storeName: string;
  itemType: string;
  itemId: string;
  itemName: string;
  itemSku: string | null;
  qtyBefore: number;
  qtyDelta: number;
  qtyAfter: number;
  reason: string | null;
  referenceType: string | null;
  referenceId: string | null;
  movementKind: string;
  createdAtUtc: string;
  performedByUserId: string | null;
}

export interface PlatformRecentInventoryAdjustmentsResponseDto {
  items: PlatformRecentInventoryAdjustmentDto[];
  take: number;
}

export interface PlatformOutOfStockQuery {
  tenantId?: string;
  storeId?: string;
  itemType?: string;
  search?: string;
  onlyTracked?: boolean;
  top?: number;
}

export interface PlatformOutOfStockRowDto {
  tenantId: string;
  tenantName: string;
  storeId: string;
  storeName: string;
  itemType: string;
  itemId: string;
  itemName: string;
  itemSku: string | null;
  stockOnHandQty: number;
  updatedAtUtc: string;
  lastAdjustmentAtUtc: string | null;
}

export interface PlatformOutOfStockResponseDto {
  items: PlatformOutOfStockRowDto[];
}
