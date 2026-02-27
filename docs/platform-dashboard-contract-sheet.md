# Platform Dashboard Contract Sheet v1

## Security

Todos los endpoints usan `PlatformOnly` (`SuperAdmin`) y no requieren `X-Tenant-Id`.

## Endpoints

### GET `/api/v1/platform/dashboard/summary`
Query params:
- `dateFrom` (`DateTimeOffset?`)
- `dateTo` (`DateTimeOffset?`)
- `threshold` (`decimal`, default `5`)

Response: `PlatformDashboardSummaryDto`
- `activeTenants`, `inactiveTenants`, `activeStores`, `inactiveStores`, `totalUsers`
- `usersWithoutStoreAssignment`, `tenantsWithoutCatalogTemplate`, `storesWithoutAdminStore`
- `salesTodayCount`, `salesTodayAmount`, `salesLast7DaysCount`, `salesLast7DaysAmount`
- `openShiftsCount`, `outOfStockItemsCount`, `lowStockItemsCount`
- `effectiveDateFromUtc`, `effectiveDateToUtc`, `effectiveLowStockThreshold`

### GET `/api/v1/platform/dashboard/top-tenants`
Query params:
- `dateFrom` (`DateTimeOffset?`)
- `dateTo` (`DateTimeOffset?`)
- `top` (`int`, default `10`, max `50`)
- `includeInactive` (`bool`, default `false`)

Response: `PlatformTopTenantsResponseDto`
- `items[]: PlatformTopTenantRowDto`
  - `tenantId`, `tenantName`, `verticalId`, `verticalName`
  - `storeCount`, `salesCount`, `salesAmount`, `averageTicket`, `voidedSalesCount`
- `effectiveDateFromUtc`, `effectiveDateToUtc`, `top`, `includeInactive`

### GET `/api/v1/platform/dashboard/alerts`
Response: `PlatformDashboardAlertsResponseDto`
- `alerts[]: PlatformDashboardAlertDto`
  - `code`, `severity`, `count`, `description`, `topExamples[]`

Alert codes v1:
- `TENANT_WITHOUT_TEMPLATE`
- `STORE_WITHOUT_ADMINSTORE`
- `STORE_SCOPED_USER_WITHOUT_STORE`

### GET `/api/v1/platform/dashboard/recent-inventory-adjustments`
Query params:
- `take` (`int`, default `20`, max `100`)
- `reason` (`string?`)
- `tenantId` (`Guid?`)
- `storeId` (`Guid?`)

Response: `PlatformRecentInventoryAdjustmentsResponseDto`
- `items[]: PlatformRecentInventoryAdjustmentDto`
  - `adjustmentId`, `tenantId`, `tenantName`, `storeId`, `storeName`
  - `itemType`, `itemId`, `itemName`, `itemSku`
  - `qtyBefore`, `qtyDelta`, `qtyAfter`, `reason`
  - `referenceType`, `referenceId`, `movementKind`
  - `createdAtUtc`, `performedByUserId`
- `take`

### GET `/api/v1/platform/dashboard/out-of-stock`
Query params:
- `tenantId` (`Guid?`)
- `storeId` (`Guid?`)
- `itemType` (`string?`, `Product|Extra|OptionItem`)
- `search` (`string?`)
- `onlyTracked` (`bool`, default `true`)
- `top` (`int`, default `50`, max `200`)

Response: `PlatformOutOfStockResponseDto`
- `items[]: PlatformOutOfStockRowDto`
  - `tenantId`, `tenantName`, `storeId`, `storeName`
  - `itemType`, `itemId`, `itemName`, `itemSku`
  - `stockOnHandQty`, `updatedAtUtc`, `lastAdjustmentAtUtc`

## Errors

- `403 Forbidden`: usuario sin rol `SuperAdmin`.
- `401 Unauthorized`: token inválido/ausente.
