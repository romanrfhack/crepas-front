# Testing Matrix (Feature/Endpoint → Tests → Qué actualizar)

Base inicial derivada de `docs/Corte-Implementacion.md` para estandarizar mantenimiento de pruebas.

| Feature / Endpoint                                                                                | Tests existentes (base)                                                                                                                                                                      | Si se modifica, qué actualizar                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/pos/sales` (crear venta)                                                            | Integration backend de creación, reglas de pago/idempotencia y cálculo server-side (según corte).                                                                                            | Integration tests de contrato (request/response), reglas de `payment.reference`, idempotencia `clientSaleId`; Vitest si cambia mapping UI; E2E UI-contract POS si cambia flujo de venta/cobro.                    |
| `GET /api/v1/pos/reports/daily-summary`                                                           | Integration backend para agregado diario (según corte).                                                                                                                                      | Integration tests de filtros y shape de respuesta; E2E si afecta pantalla operativa/reportes visibles.                                                                                                            |
| `GET /api/v1/pos/reports/top-products`                                                            | Cobertura en servicio con verificación principal; pendiente robustecer empates/orden estable (según corte).                                                                                  | Integration/backend tests para orden estable y empates; actualizar docs de reporte si cambia contrato.                                                                                                            |
| `GET /api/v1/pos/reports/top-products` (filtros opcionales `storeId`, `cashierUserId`, `shiftId`) | `backend/tests/CobranzaDigital.Api.Tests/PosReportsIntegrationTests.cs` valida compat + filtros nuevos sin romper contrato previo.                                                           | Mantener pruebas de compatibilidad y filtros cuando evolucione el reporte.                                                                                                                                        |
| `GET /api/v1/pos/reports/sales/daily`                                                             | `backend/tests/CobranzaDigital.Api.Tests/PosReportsIntegrationTests.cs` valida tickets/totales/avgTicket, exclusión de voided y agrupación por fecha local.                                  | Mantener Integration tests con casos multi-día y verificar TZ (`Store.TimeZoneId`) + filtros por store.                                                                                                           |
| `GET /api/v1/pos/reports/payments/methods`                                                        | `backend/tests/CobranzaDigital.Api.Tests/PosReportsIntegrationTests.cs` valida suma por método excluyendo voided.                                                                            | Ajustar Integration tests al agregar métodos de pago o reglas de exclusión.                                                                                                                                       |
| `GET /api/v1/pos/reports/sales/hourly`                                                            | `backend/tests/CobranzaDigital.Api.Tests/PosReportsIntegrationTests.cs` valida buckets por hora local.                                                                                       | Actualizar pruebas de TZ y agrupación cuando cambie lógica de negocio/husos.                                                                                                                                      |
| `GET /api/v1/pos/reports/sales/cashiers`                                                          | `backend/tests/CobranzaDigital.Api.Tests/PosReportsIntegrationTests.cs` valida agregación por `CreatedByUserId` y voids por cajero.                                                          | Mantener pruebas de agregación y permisos (AdminStore/Manager vs Cashier).                                                                                                                                        |
| `GET /api/v1/pos/reports/shifts/summary`                                                          | `backend/tests/CobranzaDigital.Api.Tests/PosReportsIntegrationTests.cs` valida tickets, totales, pagos y `cashDifference` por turno.                                                         | Actualizar Integration tests al cambiar reglas de cierre/caja o filtros por cashier.                                                                                                                              |
| `GET /api/v1/pos/reports/voids/reasons`                                                           | `backend/tests/CobranzaDigital.Api.Tests/PosReportsIntegrationTests.cs` valida count/amount por razón y sólo ventas voided.                                                                  | Agregar casos si se incorporan nuevas razones o textos normalizados.                                                                                                                                              |
| `GET /api/v1/pos/reports/sales/categories`                                                        | `backend/tests/CobranzaDigital.Api.Tests/PosReportsV2IntegrationTests.cs` valida mix por categoría y `grossSales` incluyendo extras + selections.                                            | Mantener pruebas de TZ (`Store.TimeZoneId`), exclusión de voided y filtros `storeId/cashierUserId/shiftId`.                                                                                                       |
| `GET /api/v1/pos/reports/sales/products`                                                          | `backend/tests/CobranzaDigital.Api.Tests/PosReportsV2IntegrationTests.cs` valida top, snapshots (`sku/productName`) y `grossSales` con extras + selections.                                  | Actualizar pruebas al cambiar top/defaults, shape de respuesta o reglas de cálculo por línea.                                                                                                                     |
| `GET /api/v1/pos/reports/sales/addons/extras`                                                     | `backend/tests/CobranzaDigital.Api.Tests/PosReportsV2IntegrationTests.cs` valida acumulado de extras más vendidos (`quantity` y `grossSales`).                                               | Agregar casos de empate/orden y verificar exclusión de ventas voided.                                                                                                                                             |
| `GET /api/v1/pos/reports/sales/addons/options`                                                    | `backend/tests/CobranzaDigital.Api.Tests/PosReportsV2IntegrationTests.cs` valida `usageCount` ponderado por cantidad y `grossImpact` por `PriceDeltaSnapshot`.                               | Mantener pruebas de ponderación por `SaleItems.Quantity` y casos con `PriceDeltaSnapshot` cero/negativo.                                                                                                          |
| `GET /api/v1/pos/reports/kpis/summary`                                                            | `backend/tests/CobranzaDigital.Api.Tests/PosReportsV2IntegrationTests.cs` valida `tickets`, `totalItems`, `avgTicket`, `avgItemsPerTicket`, `voidRate`.                                      | Actualizar casos cuando cambie la definición de KPIs (denominador de void rate, redondeos, exclusiones).                                                                                                          |
| `GET /api/v1/pos/reports/control/cash-differences`                                                | `backend/tests/CobranzaDigital.Api.Tests/PosReportsV2IntegrationTests.cs` valida salida `daily` + `shifts`, diferencias, `cashierUserId` + `cashierUserName` y conteo de razones por cierre. | Mantener pruebas de agrupación por fecha local, filtros por cashier/store y consistencia expected/counted/difference; validar fallback de UI a `cashierUserId` si falta `cashierUserName`.                        |
| Flujo de turnos POS (open / preview / close)                                                      | Cobertura parcial descrita en corte para reglas de caja/cierre.                                                                                                                              | Integration backend para reglas de cierre y diferencias; E2E Playwright para flujo crítico de caja si cambia UX o contrato UI↔API.                                                                                |
| Auditoría de acciones críticas (Admin/POS)                                                        | Convención y campos documentados en `docs/auditing.md`; cobertura parcial por módulo.                                                                                                        | Tests backend que verifiquen `Action`, `EntityType`, `EntityId`, `CorrelationId`; actualizar docs si se agregan nuevas acciones/convenciones.                                                                     |
| Contratos Admin (users/roles/lock)                                                                | Compatibilidades documentadas en `docs/compatibility-notes.md`.                                                                                                                              | Integration tests de compat (`page`/`pageNumber`, `POST`/`PUT` lock, DTO roles); actualizar compatibility notes si cambia fallback.                                                                               |
| Frontend mapping/validaciones de formularios críticos                                             | Suite Vitest del frontend (según CI vigente).                                                                                                                                                | Agregar/actualizar unit tests Vitest por cada cambio de mapping, validación o normalización de payload.                                                                                                           |
| Flujos críticos UI POS (venta/cobros/cierre/void)                                                 | E2E Playwright en CI (cuando aplica frontend).                                                                                                                                               | Agregar/actualizar E2E deterministas con `data-testid` e intercept de `/api/v1/pos/**` para validar contrato y resultado en UI.                                                                                   |
| POS Reports v1 UI (`/app/pos/reportes`)                                                           | Unit tests Vitest (`pos-reports-api.service.spec.ts`, `pos-reportes.page.spec.ts`) y E2E Playwright (`frontend/e2e/pos.reports.contract.spec.ts`) para contrato UI↔API.                      | Mantener unit tests de filtros/mapping y E2E determinista con intercept de `/api/v1/pos/**` al cambiar filtros, TZ o tablas del dashboard.                                                                        |
| POS Reports v2 UI (`/app/pos/reportes`)                                                           | Unit tests Vitest (`pos-reports-api.service.spec.ts`, `pos-reportes.page.spec.ts`) para endpoints v2 + errores por bloque y E2E Playwright (`frontend/e2e/pos.reports.v2.contract.spec.ts`). | Validar query params de v2 (`dateFrom/dateTo/storeId?/cashierUserId?/shiftId?/top?`), render con `data-testid` nuevos (`kpi-*`, `mix-*`, `addons-*`, `cash-diff-*`) e intercept determinista de `/api/v1/pos/**`. |
| Endpoints v2 reportes operativos (`kpis`, `mix`, `addons`, `cash-differences`)                    | Backend integration (`PosReportsV2IntegrationTests.cs`) + Frontend API/UI contract tests (Vitest + Playwright).                                                                              | Si cambia contrato/shape de DTOs, actualizar backend integration + modelos FE + specs unit/e2e y documentación en `docs/pos-reports.md`.                                                                          |

## Uso recomendado en PR

1. Identifica la fila del feature/endpoint impactado.
2. Actualiza tests de la columna “qué actualizar”.
3. Si el cambio introduce un nuevo feature/endpoint, agrega una nueva fila a esta matriz.
4. Vincula también cambios de contrato en `docs/compatibility-notes.md` cuando aplique.

| `GET /api/v1/pos/catalog/snapshot` | `backend/tests/CobranzaDigital.Api.Tests/PosCatalogIntegrationTests.cs` valida autorización, payload con `isAvailable` y contrato de ETag/304. | Actualizar al modificar shape del snapshot, reglas de store/timezone o estrategia de cache. |

| Disponibilidad al crear venta (`POST /api/v1/pos/sales`) | `backend/tests/CobranzaDigital.Api.Tests/PosSalesIntegrationTests.cs` valida `409` para `Product/Extra/OptionItem` no disponibles y `400` para IDs inválidos. | Ajustar cuando cambien reglas de disponibilidad o formato de errores `ProblemDetails`. |

| POS snapshot caching (ETag/If-None-Match/304) en frontend | `frontend/src/app/features/pos/services/pos-catalog-snapshot.service.spec.ts` valida guardado de ETag, envío de `If-None-Match`, fallback de `304` y prioridad de `storeId`. | Actualizar al cambiar estrategia de cache cliente, scoping por tienda o firma de `getSnapshot/invalidate`. |

| POS UI disponibilidad (`isAvailable`) | Unit: `frontend/src/app/features/pos/pages/pos-caja.page.spec.ts`. E2E UI-contract: `frontend/e2e/pos.release1.contract.spec.ts` (producto disabled + stale cache con `409`). | Actualizar si cambia copy/UX de “Agotado”, testids, o flujo de refresh de catálogo tras `409`. |

| Admin catálogo toggles de disponibilidad (Product/Extra/OptionItem) | Unit: `frontend/src/app/features/admin/pos-catalog/services/pos-catalog-api.service.spec.ts` valida `isAvailable` en payloads; specs de rutas admin validan rol para `pos/catalog`. | Actualizar al cambiar payloads CRUD, estrategia optimista/rollback o políticas de rol (AdminStore/Manager). |

## Cobertura específica: stale cache -> refresh (Disponibilidad v1)

| Flujo / Contrato                                          | Tests nuevos/reforzados                                                                                                              | Qué validar al tocarlo                                                                                                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Snapshot cacheable (`GET /api/v1/pos/catalog/snapshot`)   | `backend/tests/CobranzaDigital.Api.Tests/PosCatalogIntegrationTests.cs` (`Snapshot_Uses_Etag_And_Changes_When_Availability_Changes`) | Secuencia `200 -> 304` con `If-None-Match` y regreso a `200` con `ETag` distinto tras cambios de disponibilidad/catálogo.                                       |
| `409 ItemUnavailable` en venta (`POST /api/v1/pos/sales`) | `backend/tests/CobranzaDigital.Api.Tests/PosSalesIntegrationTests.cs` (Product/Extra/OptionItem no disponibles)                      | `ProblemDetails.Extensions` debe incluir siempre `itemType`, `itemId`, `itemName` (string vacío cuando no hay nombre).                                          |
| Cache por store en frontend                               | `frontend/src/app/features/pos/services/pos-catalog-snapshot.service.spec.ts`                                                        | La clave de `localStorage` debe estar scoped por store; al cambiar store activo se invalida cache anterior y el siguiente load fuerza snapshot del nuevo store. |
| UX 409 + refresh de catálogo                              | Unit: `frontend/src/app/features/pos/pages/pos-caja.page.spec.ts`; E2E: `frontend/e2e/pos.release1.contract.spec.ts`                 | Mensaje claro de no disponibilidad, CTA “Actualizar catálogo”, invalida cache stale y re-renderiza disponibilidad actualizada.                                  |

| Platform endpoints (`/api/v1/platform/verticals`, `/api/v1/platform/tenants`) | Backend integration: `TenantIsolationIntegrationTests.cs` valida `PlatformOnly` + listado cross-tenant para SuperAdmin. | Mantener cobertura de autorización por rol (`SuperAdmin` vs tenant roles) y contratos CRUD mínimos para vertical/tenant. |
| Tenant isolation POS (`reports`, `catalog snapshot`, `shifts/sales`) | Backend integration: `TenantIsolationIntegrationTests.cs` + suites POS existentes con `TenantId` en seed. | Verificar que `storeId` fuera de tenant regrese `404/403` y que queries nunca mezclen Tenant A/B. |

| SuperAdmin cross-tenant reports (`/api/v1/pos/reports/kpis/summary`) | Backend integration: `backend/tests/CobranzaDigital.Api.Tests/TenantIsolationIntegrationTests.cs` (`SuperAdmin_CanReadGlobalAndTenantScopedKpisReports`). | Validar agregado global (A+B) sin header y scoping por `X-Tenant-Id` para Tenant A/B. |
| Tenant override isolation (`X-Tenant-Id`) | Backend integration: `backend/tests/CobranzaDigital.Api.Tests/TenantIsolationIntegrationTests.cs` (`Manager_CannotOverrideTenantHeader`). | Usuarios tenant no deben poder forzar otro tenant; respuesta esperada `403`. |
| Platform mode tenant-required endpoints (`/pos/catalog/snapshot`, `/pos/admin/*`) | Backend integration: `backend/tests/CobranzaDigital.Api.Tests/TenantIsolationIntegrationTests.cs` (`SuperAdmin_OperationalEndpoints_RequireTenantSelectionInPlatformMode`). | `SuperAdmin` sin tenant efectivo debe recibir `400 tenantId required...`; con `X-Tenant-Id` debe responder `200`. |

| Snapshot template + tenant overrides + store availability | `backend/tests/CobranzaDigital.Api.Tests/PosCatalogIntegrationTests.cs` (`Snapshot_Uses_Etag_And_Changes_When_Availability_Changes`) | Validar exclusión de items disabled, `isAvailable` por store, y ciclo `200 -> 304 -> 200` cuando cambian overrides/disponibilidad. |
| Create sale validation disabled vs unavailable | `backend/tests/CobranzaDigital.Api.Tests/PosSalesIntegrationTests.cs` (`CreateSale_ReturnsConflict_WithStableItemUnavailablePayload_When_Product_NotAvailable`) | `409` con `reason=DisabledByTenant` para override tenant y `reason=UnavailableInStore` para disponibilidad operativa. |

- Platform templates UI: Unit (PlatformCatalogTemplatesApiService, platform tenant interceptor) + E2E UI-contract (routes /app/platform/_ con data-testid platform-_)
- Platform Verticals UI: Unit (`frontend/src/app/features/platform/services/platform-verticals-api.service.spec.ts`, `frontend/src/app/features/platform/pages/verticals/verticals.page.spec.ts`, interceptor `frontend/src/app/core/http/platform-tenant.interceptor.spec.ts`) + E2E UI-contract (`frontend/e2e/platform.tenants.verticals.contract.spec.ts`).
- Platform Tenants UI: Unit (`frontend/src/app/features/platform/services/platform-tenants-api.service.spec.ts`, `frontend/src/app/features/platform/pages/tenants/tenants.page.spec.ts`, interceptor `frontend/src/app/core/http/platform-tenant.interceptor.spec.ts`) + E2E UI-contract (`frontend/e2e/platform.tenants.verticals.contract.spec.ts`).
- Tenant overrides/availability UI: Unit (POS admin catalog services + error propagation) + E2E UI-contract (override-toggle-_, availability-toggle-_)

| POS admin overrides enriquecido (`GET /api/v1/pos/admin/catalog/overrides`) | Backend integration: `backend/tests/CobranzaDigital.Api.Tests/PosCatalogIntegrationTests.cs` (`Catalog_Overrides_Get_Returns_Item_Metadata`). | Mantener cobertura de metadatos opcionales (`itemName`, `itemSku`, `catalogTemplateId`) y compatibilidad de campos existentes (`itemType`, `itemId`, `isEnabled`). |
| POS admin availability GET (`GET /api/v1/pos/admin/catalog/availability`) | Backend integration: `backend/tests/CobranzaDigital.Api.Tests/PosCatalogIntegrationTests.cs` (`Catalog_Availability_Get_Returns_Empty_And_Overrides_By_Store`, `SuperAdmin_Can_Read_CatalogAvailability_With_Tenant_Override_Header`) y `backend/tests/CobranzaDigital.Api.Tests/TenantIsolationIntegrationTests.cs` (`Manager_CannotRead_CatalogAvailability_FromAnotherTenantStore`). | Validar lista vacía sin overrides, listado con items cuando existen, ownership por `storeId`, y acceso de `SuperAdmin` con `X-Tenant-Id`. |

| Inventory snapshot filtering (`ShowOnlyInStock=true`) | Backend integration: `backend/tests/CobranzaDigital.Api.Tests/PosCatalogIntegrationTests.cs` (`Snapshot_Filters_OutOfStock_When_ShowOnlyInStock_Enabled_And_Etag_Changes_After_Adjustment`). | Verificar que productos con `OnHand=0` no aparezcan y que `ETag` cambie al ajustar stock a `>0`. |
| POS sale out-of-stock + concurrency | Backend integration: `backend/tests/CobranzaDigital.Api.Tests/PosSalesIntegrationTests.cs` (`CreateSale_Returns_OutOfStock_When_ShowOnlyInStock_Enabled_And_InsufficientInventory`, `CreateSale_Concurrent_LastUnit_Allows_One_And_Rejects_Other_When_ShowOnlyInStock_Enabled`). | `409 OutOfStock` con `availableQty`; en carrera por último stock, una venta debe pasar y otra fallar. |
| Inventory admin ownership/superadmin override | Backend integration: `backend/tests/CobranzaDigital.Api.Tests/TenantIsolationIntegrationTests.cs` (`Inventory_Upsert_Enforces_TenantOwnership_And_Allows_SuperAdmin_With_TenantHeader`). | Tenant user no debe escribir inventario de otra tienda; SuperAdmin con `X-Tenant-Id` sí puede. |
| Inventory UI (Release C) | Frontend Unit: `frontend/src/app/features/admin/pos-catalog/services/pos-inventory-admin-api.service.spec.ts`, `frontend/src/app/features/admin/pos-catalog/pages/inventory/inventory.page.spec.ts`; E2E UI-contract: `frontend/e2e/pos.inventory.releasec.contract.spec.ts` | Validar URL/query/payload de inventory/settings, flujo de edición de `onHand`, y errores 400 tenant-required en modo plataforma. |
| POS OutOfStock UI-contract (Release C) | Frontend Unit: `frontend/src/app/features/pos/pages/pos-caja.page.spec.ts`; E2E UI-contract: `frontend/e2e/pos.inventory.releasec.contract.spec.ts` | Para `POST /api/v1/pos/sales` con `409 OutOfStock`, la UI debe mostrar `outofstock-alert` + item y `availableQty` cuando exista. |

| Inventory admin GET template coverage (Release C.1/C.1.1 DTO) | Backend integration: `backend/tests/CobranzaDigital.Api.Tests/PosCatalogIntegrationTests.cs` (`Inventory_Get_Includes_Template_Products_Without_Row_With_Default_Zeroes`, `Inventory_Get_Filters_By_Search_Name_And_Sku`, `Inventory_Get_OnlyWithStock_Returns_Products_With_OnHand_Greater_Than_Zero`) + `backend/tests/CobranzaDigital.Api.Tests/TenantIsolationIntegrationTests.cs` (`Inventory_Get_Enforces_TenantOwnership_And_Allows_SuperAdmin_With_TenantHeader`). Frontend Unit/E2E: `frontend/src/app/features/admin/pos-catalog/pages/inventory/inventory.page.spec.ts`, `frontend/e2e/pos.inventory.releasec.contract.spec.ts`. | Verificar explícitamente que el payload JSON siempre incluya `hasInventoryRow` (required) y que `updatedAtUtc` pueda serializarse como `null` cuando no existe fila real de inventario; además mantener filtro local UI y ownership/superadmin del endpoint inventory. |

| Release C store override + inventory lite | Backend integration (pendiente de ampliación): snapshot/create-sale/admin endpoints. | Cubrir precedencia unificada, tenant isolation y razones 409 estables. |

### Release C backend (catalog availability + inventory lite)

- Snapshot precedence por regla: tenant disabled, store disabled, manual unavailable, out-of-stock, in-stock.
- CreateSale 409 reason estable para Product/Extra/OptionItem según precedencia.
- Admin endpoints release C: store-overrides + inventory (incluye rechazo OptionItem 400 y tenant isolation).
- Snapshot ETag: 200/304 y cambio al modificar override/inventory/manual availability.
  | Store overrides FE service contract (Release C) | Frontend Unit: `frontend/src/app/features/admin/pos-catalog/services/pos-admin-catalog-services.spec.ts` | Verifica GET/PUT/DELETE sobre `/api/v1/pos/admin/catalog/store-overrides` con `storeId/itemType/itemId` correctos. |
  | Catalog inventory lite FE service contract (Release C) | Frontend Unit: `frontend/src/app/features/admin/pos-catalog/services/pos-inventory-admin-api.service.spec.ts` | Verifica GET/PUT sobre `/api/v1/pos/admin/catalog/inventory` y compat legacy `/api/v1/pos/admin/inventory`. |
  | Admin store overrides UI (Release C) | Frontend Unit + E2E UI-contract: `frontend/src/app/features/admin/pos-catalog/pages/overrides/overrides.page.spec.ts`, `frontend/e2e/pos.inventory.releasec.contract.spec.ts` | Estado por fila, acciones enable/disable/clear con rollback visual y testids estables por tipo/id. |
  | Admin inventory lite UI (Release C) | Frontend Unit + E2E UI-contract: `frontend/src/app/features/admin/pos-catalog/pages/inventory/inventory.page.spec.ts`, `frontend/e2e/pos.inventory.releasec.contract.spec.ts` | Carga/guardado por `storeId`, request Release C correcto para Product/Extra, OptionItem no editable. |
  | POS badges de disponibilidad (Release C reasons) | E2E UI-contract: `frontend/e2e/pos.inventory.releasec.contract.spec.ts` | `availability-badge-{type}-{id}` visible con `DisabledByStore/OutOfStock` y controles deshabilitados. |
  | Inventory adjustments API (Release C.1) | Backend integration: `backend/tests/CobranzaDigital.Api.Tests/PosCatalogIntegrationTests.cs` (`CatalogInventory_Adjustment_For_Product_Updates_Balance_And_Creates_History_With_Audit`, `CatalogInventory_Adjustment_Validates_OptionItem_Reason_Delta_And_NegativeStock`, `CatalogInventory_Adjustment_Rejects_Item_When_Not_Tracked_And_Negative_Result`). | Validar alta de movimiento, actualización de saldo, reglas 400/409 y auditoría `AdjustInventory`. |
  | Inventory adjustments tenant isolation + superadmin | Backend integration: `backend/tests/CobranzaDigital.Api.Tests/TenantIsolationIntegrationTests.cs` (`Inventory_Adjustments_Enforce_Tenant_Isolation_And_SuperAdmin_TenantHeader`). | Tenant A no ajusta tenant B; SuperAdmin con `X-Tenant-Id` sí. |
  | Inventory reports current/low/out (Release C.1) | Backend integration: `backend/tests/CobranzaDigital.Api.Tests/PosCatalogIntegrationTests.cs` (`CatalogInventory_Adjustment_For_Product_Updates_Balance_And_Creates_History_With_Audit`, `Inventory_Reports_Low_And_Out_Of_Stock_Work_With_Threshold`) + `backend/tests/CobranzaDigital.Api.Tests/TenantIsolationIntegrationTests.cs` (`Inventory_Reports_Reject_Cashier_With_Forbidden`). | Cobertura de reportes por store y threshold, más autorización (Cashier 403). |

| Inventory adjustments FE + history UI (Release C.1) | Frontend Unit: `frontend/src/app/features/admin/pos-catalog/services/pos-inventory-adjustments-api.service.spec.ts`, `frontend/src/app/features/admin/pos-catalog/pages/inventory/inventory.page.spec.ts`; E2E UI-contract: `frontend/e2e/pos.inventory.c1.contract.spec.ts` | Verificar payload `createAdjustment` (incluye `clientOperationId`), filtros de historial y render estable de success/error con `data-testid` y reason code `409`. |
| POS reports inventory blocks FE (Release C.1) | Frontend Unit: `frontend/src/app/features/pos/services/pos-reports-api.service.spec.ts`, `frontend/src/app/features/pos/pages/pos-reportes.page.spec.ts`; E2E UI-contract: `frontend/e2e/pos.inventory.c1.contract.spec.ts` | Validar consumo de `/inventory/current|low-stock|out-of-stock`, propagación de filtros (`storeId`, `itemType`, `search`, `threshold`) y errores por bloque. |

## Release C.2 — inventory consumption on sale/void

| Escenario                                                                              | Cobertura                                                                                                                                                                                                                                                                                    | Resultado esperado                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Create sale consume tracked Product/Extra + idempotencia por `clientSaleId`            | Backend integration: `backend/tests/CobranzaDigital.Api.Tests/PosSalesIntegrationTests.cs` (`CreateSale_Consumes_Tracked_Product_And_Writes_Adjustment`, `CreateSale_Consumes_Tracked_Extra_And_Void_Reverses_With_Idempotency`).                                                            | Ajustes `SaleConsumption` (delta negativo), sin doble descuento en retry idempotente.                                                                                                                                                         |
| Void revierte stock + idempotencia por `clientVoidId`                                  | Backend integration: `backend/tests/CobranzaDigital.Api.Tests/PosSalesIntegrationTests.cs` (`CreateSale_Consumes_Tracked_Extra_And_Void_Reverses_With_Idempotency`).                                                                                                                         | Ajustes `VoidReversal` (delta positivo), sin doble reversa en retry idempotente.                                                                                                                                                              |
| Prevent negative stock en create sale tracked                                          | Backend integration: `backend/tests/CobranzaDigital.Api.Tests/PosSalesIntegrationTests.cs` (`CreateSale_Prevents_Negative_Stock_And_Does_Not_Create_Adjustments`).                                                                                                                           | `409 reason=OutOfStock`, sin cambios de saldo ni movimientos automáticos.                                                                                                                                                                     |
| Historial FE C.2/C.2.1 movementKind + referencias + fallback                           | Frontend Unit: `frontend/src/app/features/admin/pos-catalog/pages/inventory/inventory-adjustment-reason.util.spec.ts`, `frontend/src/app/features/admin/pos-catalog/pages/inventory/inventory.page.spec.ts`; E2E UI-contract: `frontend/e2e/pos.inventory.c1.contract.spec.ts` (spec C.2.1). | Render estable por `data-testid` para `movementKind` (`SaleConsumption`/`VoidReversal`), referencia amigable (`referenceType/referenceId`) y fallback seguro para metadata `null`/unknown.                                                    |
| Historial inventory adjustments expone metadata opcional C.2.1                         | Backend integration: `backend/tests/CobranzaDigital.Api.Tests/PosCatalogIntegrationTests.cs` (`CatalogInventory_Adjustment_History_Exposes_Reference_Metadata_When_Present`).                                                                                                                | Manual adjustments mantienen `referenceType/referenceId/movementKind` en `null`; movimientos automáticos exponen `Sale                                                                                                                        | SaleVoid`, `saleId`y`movementKind` esperado. |
| Admin users scoping (`GET/POST/PUT /api/v1/admin/users*`)                              | Integration backend (authz + tenant/store scope), frontend unit guards/users mapping, E2E UI-contract de visibilidad por rol                                                                                                                                                                 | Validar matrix SuperAdmin/TenantAdmin/AdminStore vs Manager/Cashier, filtros tenant/store.                                                                                                                                                    |
| Admin users temporary password v5 (`POST /api/v1/admin/users/{id}/temporary-password`) | Backend integration: `backend/tests/CobranzaDigital.Api.Tests/AdminUsersTemporaryPasswordIntegrationTests.cs`                                                                                                                                                                                | Validar scope por actor (SuperAdmin/TenantAdmin/AdminStore), restricciones por rol objetivo, `403` para Manager/Cashier, validaciones `400`, `404` usuario inexistente, auditoría sin exponer `temporaryPassword` y login con password nuevo. |

| Platform Dashboard v1 (`/api/v1/platform/dashboard/*`) | Backend integration: `backend/tests/CobranzaDigital.Api.Tests/PlatformDashboardIntegrationTests.cs` | Validar acceso `SuperAdmin` vs demás roles (403), summary/top-tenants/alerts, recent adjustments y out-of-stock con filtros cross-tenant. |
| Platform Dashboard v2 (`/api/v1/platform/dashboard/sales-trend|top-void-tenants|stockout-hotspots|activity-feed|executive-signals`) | Backend integration: `backend/tests/CobranzaDigital.Api.Tests/PlatformDashboardIntegrationTests.cs` | Validar authz `SuperAdmin` only (403 para demás), buckets/rangos de `sales-trend`, orden/top en `top-void-tenants`, filtros en `stockout-hotspots`, mezcla/filtro en `activity-feed` y coherencia de `executive-signals`. |
| Platform Dashboard v3 (`/api/v1/platform/dashboard/alerts/drilldown|tenants/{tenantId}/overview|stores/{storeId}/stockout-details`) | Backend integration: `backend/tests/CobranzaDigital.Api.Tests/PlatformDashboardIntegrationTests.cs` | Validar authz `SuperAdmin` only (403 para demás), alert drilldown por códigos soportados + invalid code (400), tenant overview coherente con seed multi-tenant y stockout details con filtros `mode/search/threshold`. |

## Platform Dashboard v1 (SuperAdmin)

- Unit (Vitest): `PlatformDashboardApiService` query mapping para `summary`, `top-tenants`, `alerts`, `recent-inventory-adjustments`, `out-of-stock`.
- Unit (Vitest): `PlatformDashboardPage` render de KPI cards, errores por bloque, refresh global y filtros (`top-tenants`, `out-of-stock`).
- E2E (Playwright UI-contract): `frontend/e2e/platform.dashboard.contract.spec.ts` interceptando `**/api/v1/platform/dashboard/**` con asserts por `data-testid`.

| Admin users scoped UX v2 (`/app/admin/users`) | Frontend Unit: `frontend/src/app/features/admin/pages/users-admin/users-admin.page.spec.ts`; E2E UI-contract: `frontend/e2e/admin.users.scoped-ux.contract.spec.ts` | Validar badges de alcance por rol (SuperAdmin/TenantAdmin/AdminStore), filtros tenant/store con visibilidad correcta, `StoreId` obligatorio visual para `AdminStore`/`Manager`/`Cashier`, y mensajes success/error por `data-testid`. |
| Admin users scoped create v4.1 (`POST /api/v1/admin/users` desde UI contextual) | Frontend Unit: `frontend/src/app/features/admin/services/admin-users.service.spec.ts`, `frontend/src/app/features/admin/pages/users-admin/users-admin.page.spec.ts`; E2E UI-contract: `frontend/e2e/admin.users.scoped-ux.contract.spec.ts` | Validar payload exacto (`email`, `userName`, `role`, `tenantId`, `storeId`, `temporaryPassword`), prefill tenant/store por query params/filtros, mapeo de errores `409/400` a `admin-user-form-error`, submit anti doble click y refresh de listado tras éxito. |

| Frontend `/app/platform/dashboard` v2 (executive signals, sales trend, top void tenants, stockout hotspots, activity feed) | `frontend/src/app/features/platform/services/platform-dashboard-api.service.spec.ts`, `frontend/src/app/features/platform/pages/dashboard/platform-dashboard.page.spec.ts`, `frontend/e2e/platform.dashboard.v2.contract.spec.ts` | Si cambia mapping/filtros, actualizar unit tests Vitest de query params y estado por bloque. Si cambia UX/flujo de dashboard, mantener Playwright UI-contract determinista con `route` a `/api/v1/platform/dashboard/**` y asserts por `data-testid`. |

## 2026-02-27 — Platform Dashboard v3 frontend drilldown coverage

- Frontend dashboard agrega drilldown accionable en alertas, top tenants y stockout hotspots.
- Unit tests Vitest:
  - `PlatformDashboardApiService`: query params de `alerts/drilldown`, `tenants/{tenantId}/overview`, `stores/{storeId}/stockout-details`.
  - `PlatformDashboardPage`: apertura de paneles drilldown, estados loading/error/empty y filtros de stockout detail.
- E2E Playwright UI-contract: `frontend/e2e/platform.dashboard.v3.contract.spec.ts` intercepta `**/api/v1/platform/dashboard/**` y valida drilldowns usando `data-testid`.

## 2026-02-27 — Platform Dashboard v3.1 quick actions to scoped users

- Frontend dashboard v3 agrega CTAs de navegación rápida desde drilldown:
  - alert codes `STORE_WITHOUT_ADMINSTORE`, `STORE_SCOPED_USER_WITHOUT_STORE`, `TENANT_WITHOUT_TEMPLATE`.
  - tenant overview (`platform-tenant-overview-action-users`).
  - store stockout details (`platform-store-stockout-action-users`).
- Frontend Unit (Vitest):
  - `frontend/src/app/features/platform/pages/dashboard/platform-dashboard.page.spec.ts` valida navegación con query params y degradación disabled cuando falta contexto.
  - `frontend/src/app/features/admin/pages/users-admin/users-admin.page.spec.ts` valida inicialización de filtros (`tenantId`, `storeId`, `search`) desde query params en `/app/admin/users`.
- E2E Playwright UI-contract:
  - `frontend/e2e/platform.dashboard.v3.contract.spec.ts` valida navegación end-to-end dashboard→users con query params esperados y asserts por `data-testid`.

## 2026-02-27 — Admin Users v3 contextual create form (prefill only)

- Estado de contrato backend v4: `AdminUsersController` expone `GET /api/v1/admin/users*`, `POST /api/v1/admin/users`, `PUT /api/v1/admin/users/{id}/roles`, `POST|PUT /api/v1/admin/users/{id}/lock`.
- Frontend Unit (Vitest):
  - `frontend/src/app/features/admin/pages/users-admin/users-admin.page.spec.ts` valida prefill de formulario de alta desde query params/filtros (`tenantId`, `storeId`) y sugerencia de rol por contexto; conexión del submit real queda para el siguiente paso frontend.
- E2E Playwright UI-contract:
  - `frontend/e2e/admin.users.scoped-ux.contract.spec.ts` valida apertura de “Nuevo usuario” con contexto (`tenantId+storeId` y `tenantId`) y sugerencia de rol; el wiring de submit API se valida en iteración frontend posterior.
  - `frontend/e2e/platform.dashboard.v3.contract.spec.ts` valida flujo dashboard→users→nuevo usuario con prefill contextual por `data-testid`.

## 2026-02-27 — Admin Users v4 backend scoped create endpoint

- Backend integration: `backend/tests/CobranzaDigital.Api.Tests/AdminUsersCreateIntegrationTests.cs`.
- Cobertura mínima obligatoria:
  - SuperAdmin crea `TenantAdmin`/`AdminStore`/`Manager`/`Cashier` con tenant/store válidos.
  - TenantAdmin crea dentro de su tenant y recibe `403` fuera de alcance.
  - AdminStore crea solo `Manager`/`Cashier` en su propia store y recibe `403` para roles/store fuera de alcance.
  - Manager/Cashier reciben `403` al invocar create.
  - Validaciones: email duplicado (`409`), role con `storeId` faltante (`400`), store fuera de tenant (`400`), role inválido (`400`).
  - Auditoría `CreateUser` persistida.
  - `GET /admin/users` refleja al usuario creado conforme al scope del actor.

## 2026-02-27 — Admin Users v5 temporary password reset endpoint

- Backend integration: `backend/tests/CobranzaDigital.Api.Tests/AdminUsersTemporaryPasswordIntegrationTests.cs`.
- Cobertura mínima obligatoria:
  - SuperAdmin resetea password temporal en cualquier scope válido y el usuario puede autenticarse con la nueva contraseña.
  - TenantAdmin resetea solo dentro de su tenant y recibe `403` fuera de alcance.
  - AdminStore resetea solo `Manager`/`Cashier` de su store, recibe `403` fuera de store o contra `TenantAdmin`/`SuperAdmin`.
  - Manager/Cashier reciben `403` al invocar endpoint.
  - Validaciones: `temporaryPassword` faltante/invalid (`400`), usuario inexistente (`404`).
  - Auditoría `ResetUserPassword` persistida sin almacenar el valor de `temporaryPassword`.

| Admin users temporary password UI v5.1 (`/app/admin/users` + `POST /api/v1/admin/users/{id}/temporary-password`) | Frontend Unit: `frontend/src/app/features/admin/services/admin-users.service.spec.ts`, `frontend/src/app/features/admin/pages/users-admin/users-admin.page.spec.ts`; E2E UI-contract: `frontend/e2e/admin.users.scoped-ux.contract.spec.ts` | Validar payload exacto (`temporaryPassword`), apertura de modal desde fila, validaciones UI (required/min 8/confirm mismatch), submit anti doble click y mapeo estable de errores backend `400/403/404` sobre testids `admin-users-reset-password-*`. |

## 2026-02-28 — Admin Users v5.1 frontend temporary password reset UI

- Frontend Unit (Vitest):
  - `frontend/src/app/features/admin/services/admin-users.service.spec.ts` valida request exacto a `/v1/admin/users/{id}/temporary-password`.
  - `frontend/src/app/features/admin/pages/users-admin/users-admin.page.spec.ts` valida apertura del modal desde fila, validación mínima de contraseña, confirm mismatch, submit exitoso y manejo de `400/403/404` por `ProblemDetails`.
- E2E Playwright UI-contract:
  - `frontend/e2e/admin.users.scoped-ux.contract.spec.ts` valida flujo determinista de reset temporal (success + errores `400/403`) usando `data-testid` estables `admin-users-reset-password-*`.

## 2026-02-28 — Admin Users v6 scoped basic edit (backend + frontend)

- Backend Integration (API): `backend/tests/CobranzaDigital.Api.Tests/AdminUsersUpdateIntegrationTests.cs`.
  - SuperAdmin puede editar `userName/tenantId/storeId` en combinaciones válidas.
  - TenantAdmin solo edita dentro de su tenant.
  - AdminStore solo edita dentro de su store.
  - Manager/Cashier reciben `403`.
  - Validaciones: `userName` faltante/duplicado, `storeId` faltante para rol que lo requiere, store fuera de tenant, usuario inexistente.
  - Auditoría: `UpdateUser` con metadata `before/after` y `roles` del target.
  - `GET /api/v1/admin/users` refleja cambios tras update.

- Frontend Unit (Vitest):
  - `frontend/src/app/features/admin/services/admin-users.service.spec.ts` valida contrato `PUT /v1/admin/users/{id}`.
  - `frontend/src/app/features/admin/pages/users-admin/users-admin.page.spec.ts` valida apertura modal editar, prefill (`userName/tenant/store`), visual `store required`, submit exitoso con refresh y mapeo estable de errores backend `400/403/404/409`.

- Frontend E2E Playwright UI-contract:
  - `frontend/e2e/admin.users.scoped-ux.contract.spec.ts` valida flujo determinista de edición básica (`PUT /api/v1/admin/users/{id}`) con caso success + error usando `data-testid` estables `admin-user-edit-*`.

## 2026-02-28 — Platform Dashboard v3.2 quick actions to contextual user create

- Frontend Unit (Vitest):
  - `frontend/src/app/features/platform/pages/dashboard/platform-dashboard.page.spec.ts` valida navegación contextual con `intent=create-user` y `suggestedRole` para: alerta `STORE_WITHOUT_ADMINSTORE`, tenant overview y stockout details.
  - `frontend/src/app/features/admin/pages/users-admin/users-admin.page.spec.ts` valida apertura automática del formulario cuando llega `intent=create-user`, aplicación de `suggestedRole`, y cierre del formulario sin perder filtros `tenantId/storeId`.
- E2E Playwright UI-contract:
  - `frontend/e2e/platform.dashboard.v3.contract.spec.ts` valida flujo dashboard→users con quick actions v3.2 y asserts por `data-testid` (`platform-alert-drilldown-action-create-adminstore-{index}`, `platform-tenant-overview-action-create-tenantadmin`, `platform-store-stockout-action-create-user`, `admin-users-create-intent-active`).

| Platform Stores/Tenants Admin v1 (`GET /platform/tenants/{tenantId}/stores`, `GET|PUT /platform/stores/{storeId}`, `PUT /platform/tenants/{tenantId}/default-store`) | Backend integration: `backend/tests/CobranzaDigital.Api.Tests/PlatformStoresAdminIntegrationTests.cs` | Validar authz `SuperAdmin` only (403 resto de roles), cálculo `isDefaultStore` y `hasAdminStore`, detalle/404, update de store, cambio de default store, rechazo de store de otro tenant y auditoría `UpdateStore` + `UpdateTenantDefaultStore`. |
| Platform Tenant Details/Settings v1 (`GET|PUT /platform/tenants/{tenantId}`) | Backend integration: `backend/tests/CobranzaDigital.Api.Tests/PlatformTenantDetailsIntegrationTests.cs` | Validar authz `SuperAdmin` only (403 resto de roles), details con friendly fields (`verticalName`, `defaultStoreName`), métricas (`storeCount`, `activeStoreCount`, `usersCount`, `usersWithoutStoreAssignmentCount`, `storesWithoutAdminStoreCount`), `404`, validaciones (`slug` duplicado / `verticalId` inválido) y auditoría `UpdateTenant`. |

## 2026-02-28 — Platform Stores Admin v1 frontend

- Frontend Unit (Vitest):
  - `frontend/src/app/features/platform/services/platform-stores-api.service.spec.ts` valida rutas/payloads exactos para listar stores, detalle, edición y default store.
  - `frontend/src/app/features/platform/pages/tenant-stores/tenant-stores.page.spec.ts` valida render de `isDefaultStore` / `hasAdminStore`, cambio de sucursal principal, quick action `Crear AdminStore` contextual y mapeo estable de errores backend.
  - `frontend/src/app/features/platform/pages/store-details/store-details.page.spec.ts` valida submit de edición (`PUT /platform/stores/{storeId}`), cambio de default store desde detalle y manejo de `ProblemDetails`.
- Frontend E2E Playwright UI-contract:
  - `frontend/e2e/platform.stores.contract.spec.ts` valida flujo determinista `/app/platform/tenants/:tenantId/stores` → detalle/edición → cambio de default store → quick action a `/app/admin/users` con `tenantId/storeId/intent/suggestedRole`.

## 2026-03-01 — Platform Tenant details/settings v1

- Backend integration: `backend/tests/CobranzaDigital.Api.Tests/PlatformTenantDetailsIntegrationTests.cs`.
- Cobertura obligatoria:
  - `PlatformOnly` + `SuperAdmin` only (`403` resto de roles).
  - `GET /platform/tenants/{tenantId}` con fields amigables (`verticalName`, `defaultStoreName`, `catalogTemplateName`) y métricas operativas.
  - `PUT /platform/tenants/{tenantId}` con persistencia de `name/slug/isActive/verticalId`, validación de `slug` duplicado y `verticalId` inválido.
  - Auditoría `UpdateTenant` con before/after.

## Tenant details/settings v1 (frontend platform)

| Feature / Endpoint                                                                                                           | Tests existentes                                                                                                                                                                                                             | Si se modifica, qué actualizar                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/v1/platform/tenants/{tenantId}` + `PUT /api/v1/platform/tenants/{tenantId}` (UI `/app/platform/tenants/:tenantId`) | Unit: `src/app/features/platform/services/platform-tenants-api.service.spec.ts`, `src/app/features/platform/pages/tenant-details/tenant-details.page.spec.ts`. E2E: `frontend/e2e/platform.tenant-details.contract.spec.ts`. | Ajustar Unit (mapping friendly fields, métricas, ProblemDetails 400/404/409, navegación quick actions) y E2E determinista por `data-testid` para flujo abrir detalle → editar → success → CTAs stores/users. |


| Frontend Platform Tenant Details (`/app/platform/tenants/:tenantId`) quick actions hub | `frontend/src/app/features/platform/pages/tenant-details/tenant-details.page.spec.ts`, `frontend/e2e/platform.tenant-details.contract.spec.ts` | Mantener navegación contextual (stores/users/dashboard/reportes/inventario), `data-testid` de acciones y CTA de stores sin AdminStore con filtro `withoutAdminStore=true`. |
| Frontend Platform Store Details (`/app/platform/stores/:storeId`) quick actions hub | `frontend/src/app/features/platform/pages/store-details/store-details.page.spec.ts`, `frontend/e2e/platform.stores.contract.spec.ts` | Mantener navegación contextual a users/create-user/create-adminstore/dashboard/reportes/inventario y comportamiento condicional de CTA `create-adminstore` cuando `hasAdminStore=true`. |
| Frontend Inventory Admin (`/app/admin/pos/inventory`) contexto por query params | `frontend/src/app/features/admin/pos-catalog/pages/inventory/inventory.page.spec.ts` + cobertura E2E en quick actions de store/tenant detail | Si cambia prefill por query (`storeId`, `itemType`, `search`) actualizar pruebas de inicialización y navegación contextual desde hubs de tenant/store. |
| Frontend Platform Tenant Stores (`/app/platform/tenants/:tenantId/stores`) filtro `withoutAdminStore=true` | `frontend/src/app/features/platform/pages/tenant-stores/tenant-stores.page.spec.ts` | Mantener filtro frontend-only por query param y `data-testid` del estado de filtro activo. |

## 2026-02-28 — Platform Stores Admin v1.1 UX (frontend)

| Feature / Flow | Tests a mantener | Cobertura mínima obligatoria |
| --- | --- | --- |
| `/app/platform/stores/:storeId` panel operativo | `frontend/src/app/features/platform/pages/store-details/store-details.page.spec.ts` | Verificar visualización de `isDefaultStore`, `hasAdminStore`, `adminStoreUserCount`, `totalUsersInStore`; validar CTA primaria contextual (`Crear AdminStore` vs `Ver usuarios`). |
| `/app/platform/tenants/:tenantId/stores` listado operativo | `frontend/src/app/features/platform/pages/tenant-stores/tenant-stores.page.spec.ts` | Verificar resaltado visual de default store, badges de AdminStore y quick actions `Crear AdminStore`/`Ver detalle` por fila. |
| UI-contract stores admin operativo | `frontend/e2e/platform.stores.contract.spec.ts` | Validar navegación contextual con `data-testid` estable para detalle sin AdminStore, detalle con AdminStore, quick actions desde listado y estado visual de default store. |

Test IDs estables agregados en este ciclo:
- Store Detail: `platform-store-details-primary-action`, `platform-store-details-admin-count`, `platform-store-details-users-count`.
- Stores list: `platform-tenant-stores-view-details-{storeId}` (además de `platform-tenant-stores-default-{storeId}`, `platform-tenant-stores-has-admin-{storeId}`, `platform-tenant-stores-create-adminstore-{storeId}`).

## 2026-02-28 — Tenant/Store operational navigation v1.2 (frontend)

- Frontend Unit (Vitest):
  - `frontend/src/app/features/platform/pages/tenant-details/tenant-details.page.spec.ts` valida quick actions operativas a stores/users/dashboard/inventory con `tenantId` contextual.
  - `frontend/src/app/features/platform/pages/tenant-stores/tenant-stores.page.spec.ts` valida quick actions por fila a users/dashboard/inventory y contexto visual cuando `withoutAdminStore=true`.
  - `frontend/src/app/features/platform/pages/store-details/store-details.page.spec.ts` valida quick actions de sucursal a users/dashboard/inventory y flujos existentes de create user/admin store.
  - `frontend/src/app/features/platform/pages/dashboard/platform-dashboard.page.spec.ts` y `frontend/src/app/features/admin/pos-catalog/pages/inventory/inventory.page.spec.ts` validan render de badges de contexto aplicado.
- E2E Playwright UI-contract:
  - `frontend/e2e/platform.tenant-details.contract.spec.ts` valida tenant detail como hub operativo (stores/users/dashboard/inventory + review stores sin AdminStore).
  - `frontend/e2e/platform.stores.contract.spec.ts` valida stores list contextual (`withoutAdminStore=true`) y navegación operativa desde store detail/list hacia users/dashboard/inventory.
