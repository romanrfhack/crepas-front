# Platform Dashboard Contract Sheet v1 + v2

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


## v2 Endpoints (executive metrics)

> Todas las fechas/rangos de v2 se calculan en UTC y no requieren `X-Tenant-Id`.

### GET `/api/v1/platform/dashboard/sales-trend`
Query params:
- `dateFrom` (`DateTimeOffset?`)
- `dateTo` (`DateTimeOffset?`)
- `granularity` (`day|week`, default `day`)

Response: `PlatformSalesTrendResponseDto`
- `items[]: PlatformSalesTrendPointDto`
  - `bucketStartUtc`, `bucketLabel`
  - `salesCount`, `salesAmount`, `voidedSalesCount`, `averageTicket`
- `effectiveDateFromUtc`, `effectiveDateToUtc`, `granularity`

### GET `/api/v1/platform/dashboard/top-void-tenants`
Query params:
- `dateFrom` (`DateTimeOffset?`)
- `dateTo` (`DateTimeOffset?`)
- `top` (`int`, default `10`, max `50`)

Response: `PlatformTopVoidTenantsResponseDto`
- `items[]: PlatformTopVoidTenantRowDto`
  - `tenantId`, `tenantName`, `verticalId`, `verticalName`
  - `voidedSalesCount`, `voidedSalesAmount`, `totalSalesCount`, `voidRate`, `storeCount`
- `effectiveDateFromUtc`, `effectiveDateToUtc`, `top`

### GET `/api/v1/platform/dashboard/stockout-hotspots`
Query params:
- `threshold` (`decimal`, default `5`)
- `top` (`int`, default `10`, max `100`)
- `itemType` (`string?`, `Product|Extra|OptionItem`)

Response: `PlatformStockoutHotspotsResponseDto`
- `items[]: PlatformStockoutHotspotRowDto`
  - `tenantId`, `tenantName`, `storeId`, `storeName`
  - `outOfStockItemsCount`, `lowStockItemsCount`, `lastInventoryMovementAtUtc`, `trackedItemsCount`
- `threshold`, `top`, `itemType`

### GET `/api/v1/platform/dashboard/activity-feed`
Query params:
- `take` (`int`, default `20`, max `100`)
- `eventType` (`string?`, `SaleCreated|SaleVoided|InventoryAdjusted`)

Response: `PlatformActivityFeedResponseDto`
- `items[]: PlatformActivityFeedItemDto`
  - `eventType`, `occurredAtUtc`
  - `tenantId`, `tenantName`, `storeId`, `storeName`
  - `title`, `description`, `referenceId`, `severity`, `actorUserId`
- `take`, `eventType`

### GET `/api/v1/platform/dashboard/executive-signals`
Query params:
- `dateFrom` (`DateTimeOffset?`)
- `dateTo` (`DateTimeOffset?`)
- `previousPeriodCompare` (`bool`, default `true`)

Response: `PlatformExecutiveSignalsDto`
- `fastestGrowingTenantId`, `fastestGrowingTenantName`
- `salesGrowthRatePercent`, `voidRatePercent`
- `tenantsWithNoSalesInRangeCount`
- `storesWithNoAdminStoreCount`
- `tenantsWithNoCatalogTemplateCount`
- `storesWithOutOfStockCount`
- `inventoryAdjustmentCountInRange`
- `topRiskTenantId`, `topRiskTenantName`
- `effectiveDateFromUtc`, `effectiveDateToUtc`, `previousPeriodCompare`


## v3 Endpoints (drill-down accionable)

### GET `/api/v1/platform/dashboard/alerts/drilldown`
Query params:
- `code` (`string`, required)
- `take` (`int`, default `100`, max `500`)
- `tenantId` (`Guid?`)
- `storeId` (`Guid?`)

Response: `PlatformDashboardAlertDrilldownResponseDto`
- `code`
- `items[]: PlatformDashboardAlertDrilldownItemDto`
  - `tenantId`, `tenantName`, `storeId`, `storeName`
  - `userId`, `userName`, `email`, `role`
  - `description`, `reason`, `metadata`

Supported codes v3:
- `TENANT_WITHOUT_TEMPLATE`
- `STORE_WITHOUT_ADMINSTORE`
- `STORE_SCOPED_USER_WITHOUT_STORE`

Notas:
- code inválido devuelve `400 BadRequest` con mensaje estable.
- code válido sin hallazgos devuelve `items: []`.

### GET `/api/v1/platform/dashboard/tenants/{tenantId}/overview`
Query params:
- `dateFrom` (`DateTimeOffset?`)
- `dateTo` (`DateTimeOffset?`)
- `threshold` (`decimal`, default `5`)

Response: `PlatformTenantOverviewDto`
- `tenantId`, `tenantName`, `verticalId`, `verticalName`
- `storeCount`, `activeStoreCount`, `totalUsers`, `usersWithoutStoreAssignmentCount`
- `salesInRangeCount`, `salesInRangeAmount`, `voidedSalesCount`
- `outOfStockItemsCount`, `lowStockItemsCount`, `lastInventoryAdjustmentAtUtc`
- `hasCatalogTemplate`, `storesWithoutAdminStoreCount`
- `effectiveDateFromUtc`, `effectiveDateToUtc`, `effectiveThreshold`

### GET `/api/v1/platform/dashboard/stores/{storeId}/stockout-details`
Query params:
- `itemType` (`string?`, `Product|Extra|OptionItem`)
- `search` (`string?`)
- `threshold` (`decimal`, default `5`)
- `mode` (`out-of-stock|low-stock|all`, default `out-of-stock`)
- `take` (`int`, default `200`, max `500`)

Response: `PlatformStoreStockoutDetailDto`
- `storeId`, `storeName`, `tenantId`, `tenantName`
- `mode`, `effectiveThreshold`
- `items[]: PlatformStoreStockoutDetailItemDto`
  - `itemType`, `itemId`, `itemName`, `itemSku`
  - `stockOnHandQty`, `isInventoryTracked`, `availabilityReason`, `lastAdjustmentAtUtc`

Decisión MVP v3:
- Se implementan A + B + D para priorizar drill-down accionable inmediato.
- `tenant void-details` y `tenant stockout-details` quedan fuera de este corte para evitar duplicidad de contrato con B/D y mantener v3 aditivo/simple.

## Platform Stores/Tenants Admin v1 (SuperAdmin)

### `GET /api/v1/platform/tenants/{tenantId}/stores`

Devuelve listado de stores del tenant con métricas derivadas para UI operativa.

`200 OK` (array):
- `id`, `tenantId`, `name`, `isActive`, `timeZoneId`, `createdAtUtc`, `updatedAtUtc`
- `isDefaultStore` (derivado de `tenant.DefaultStoreId`)
- `hasAdminStore` (derivado por existencia de al menos un usuario con rol `AdminStore` en la store)
- `adminStoreUserCount`
- `totalUsersInStore`

Errores:
- `404` si tenant no existe.

### `GET /api/v1/platform/stores/{storeId}`

Devuelve detalle de store con metadata de tenant y métricas derivadas.

`200 OK`:
- `id`, `tenantId`, `tenantName`, `name`, `isActive`, `timeZoneId`, `createdAtUtc`, `updatedAtUtc`
- `isDefaultStore`, `hasAdminStore`, `adminStoreUserCount`, `totalUsersInStore`

Errores:
- `404` si store no existe.

### `PUT /api/v1/platform/stores/{storeId}`

Actualiza datos básicos editables de store.

Request:
```json
{
  "name": "Sucursal Centro",
  "timeZoneId": "America/Mexico_City",
  "isActive": true
}
```

Reglas de validación:
- `name` requerido.
- `timeZoneId` requerido y válido (`TimeZoneInfo`).
- `storeId` debe existir.

Auditoría:
- Acción `UpdateStore` con before/after de `name`, `timeZoneId`, `isActive`.

### `PUT /api/v1/platform/tenants/{tenantId}/default-store`

Cambia la store default del tenant.

Request:
```json
{
  "defaultStoreId": "00000000-0000-0000-0000-000000000000"
}
```

Reglas de validación:
- `tenantId` debe existir.
- `defaultStoreId` debe existir.
- La store debe pertenecer al tenant.
- La store debe estar activa.

Respuesta:
- `204 NoContent`.

Auditoría:
- Acción `UpdateTenantDefaultStore` con before/after de `defaultStoreId`.
