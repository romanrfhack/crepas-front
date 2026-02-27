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

export type PlatformSalesTrendGranularity = 'day' | 'week';

export interface PlatformSalesTrendQuery {
  dateFrom?: string;
  dateTo?: string;
  granularity?: PlatformSalesTrendGranularity;
}

export interface PlatformSalesTrendPointDto {
  bucketStartUtc: string;
  bucketLabel: string;
  salesCount: number;
  salesAmount: number;
  voidedSalesCount: number;
  averageTicket: number;
}

export interface PlatformSalesTrendResponseDto {
  items: PlatformSalesTrendPointDto[];
  effectiveDateFromUtc: string;
  effectiveDateToUtc: string;
  granularity: PlatformSalesTrendGranularity;
}

export interface PlatformTopVoidTenantsQuery {
  dateFrom?: string;
  dateTo?: string;
  top?: number;
}

export interface PlatformTopVoidTenantRowDto {
  tenantId: string;
  tenantName: string;
  verticalId: string;
  verticalName: string;
  voidedSalesCount: number;
  voidedSalesAmount: number;
  totalSalesCount: number;
  voidRate: number;
  storeCount: number;
}

export interface PlatformTopVoidTenantsResponseDto {
  items: PlatformTopVoidTenantRowDto[];
  effectiveDateFromUtc: string;
  effectiveDateToUtc: string;
  top: number;
}

export type PlatformDashboardItemType = 'Product' | 'Extra' | 'OptionItem';

export interface PlatformStockoutHotspotsQuery {
  threshold?: number;
  top?: number;
  itemType?: PlatformDashboardItemType;
}

export interface PlatformStockoutHotspotRowDto {
  tenantId: string;
  tenantName: string;
  storeId: string;
  storeName: string;
  outOfStockItemsCount: number;
  lowStockItemsCount: number;
  lastInventoryMovementAtUtc: string | null;
  trackedItemsCount: number;
}

export interface PlatformStockoutHotspotsResponseDto {
  items: PlatformStockoutHotspotRowDto[];
  threshold: number;
  top: number;
  itemType: PlatformDashboardItemType | null;
}

export type PlatformActivityFeedEventType = 'SaleCreated' | 'SaleVoided' | 'InventoryAdjusted';

export interface PlatformActivityFeedQuery {
  take?: number;
  eventType?: PlatformActivityFeedEventType;
}

export interface PlatformActivityFeedItemDto {
  eventType: PlatformActivityFeedEventType;
  occurredAtUtc: string;
  tenantId: string;
  tenantName: string;
  storeId: string;
  storeName: string;
  title: string;
  description: string;
  referenceId: string | null;
  severity: string;
  actorUserId: string | null;
}

export interface PlatformActivityFeedResponseDto {
  items: PlatformActivityFeedItemDto[];
  take: number;
  eventType: PlatformActivityFeedEventType | null;
}

export interface PlatformExecutiveSignalsQuery {
  dateFrom?: string;
  dateTo?: string;
  previousPeriodCompare?: boolean;
}

export interface PlatformExecutiveSignalsDto {
  fastestGrowingTenantId: string | null;
  fastestGrowingTenantName: string | null;
  salesGrowthRatePercent: number;
  voidRatePercent: number;
  tenantsWithNoSalesInRangeCount: number;
  storesWithNoAdminStoreCount: number;
  tenantsWithNoCatalogTemplateCount: number;
  storesWithOutOfStockCount: number;
  inventoryAdjustmentCountInRange: number;
  topRiskTenantId: string | null;
  topRiskTenantName: string | null;
  effectiveDateFromUtc: string;
  effectiveDateToUtc: string;
  previousPeriodCompare: boolean;
}
