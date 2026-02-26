# Compatibility notes (Front/Back contracts)

Este documento registra compatibilidades temporales agregadas para evitar romper clientes existentes.

## Admin users paging

- Endpoint: `GET /api/v1/admin/users`
- Parámetros aceptados:
  - `page` (contrato actual backend)
  - `pageNumber` (legacy frontend)
- Motivo: el frontend histórico enviaba `pageNumber`, por lo que el backend ahora acepta ambos y prioriza `pageNumber` cuando viene presente.

## Admin user lock

- Endpoints aceptados:
  - `POST /api/v1/admin/users/{id}/lock` (original)
  - `PUT /api/v1/admin/users/{id}/lock` (compatibilidad)
- Cuerpo: `{ "lock": true|false }`
- Motivo: el frontend utiliza `PUT`; para compatibilidad se mantiene `POST` y se agregó `PUT` apuntando a la misma lógica.

## Admin roles DTO

- Endpoint: `GET /api/v1/admin/roles`
- Respuesta consistente: lista de objetos con forma `{ "name": "RoleName" }`.
- Motivo: se normaliza un contrato explícito y estable para frontend.

## Delete role

- Endpoint: `DELETE /api/v1/admin/roles/{name}`
- El identificador para eliminar rol es el `name` del rol.
- Motivo: el backend opera por nombre de rol; el frontend fue ajustado para evitar enviar ids inexistentes.

## POS catálogo: `isAvailable` y snapshot extendido

- Endpoints admin de catálogo mantienen contratos existentes y agregan campo opcional/backward-compatible `isAvailable` en DTOs de `Product`, `Extra` y `OptionItem`.
- Endpoint `GET /api/v1/pos/catalog/snapshot` agrega metadatos (`storeId`, `timeZoneId`, `generatedAtUtc`, `catalogVersion`, `etagSeed`) manteniendo secciones previas.
- Caching HTTP incorporado con `ETag` + `If-None-Match` (`304`) sin romper clientes que no usen cache condicional.

## 2026-02-20 — Multi-tenant Release A
- Se agregó claim JWT `tenantId` para usuarios con `AspNetUsers.TenantId` configurado.
- Compatibilidad: usuarios legacy sin claim siguen resolviendo tenant por lookup en base de datos.
- Datos existentes se conservan mediante backfill a `Default Tenant` durante migración.

## 2026-02-21 — POS catálogo Release B

- `GET /api/v1/pos/catalog/snapshot` agrega campos no rompientes: `tenantId`, `verticalId`, `catalogTemplateId`.
- `409` de disponibilidad en `POST /api/v1/pos/sales` conserva `itemType/itemId/itemName` y agrega `reason` (`DisabledByTenant` o `UnavailableInStore`).

## 2026-02-21 — POS catálogo Release B (UI unblock)

- `GET /api/v1/pos/admin/catalog/overrides` mantiene campos existentes y agrega campos opcionales: `itemName`, `itemSku`, `catalogTemplateId`.
- `CatalogStoreAvailabilityDto` agrega campos opcionales: `itemName`, `itemSku` (sin romper contratos actuales).
- Se agrega endpoint nuevo `GET /api/v1/pos/admin/catalog/availability` para consultar overrides por tienda sin depender de snapshot.

## 2026-02-21 — POS inventory DTO normalization

- Se agregó `hasInventoryRow` (`bool`) en `StoreInventoryItemDto`; `updatedAtUtc` ahora puede ser `null`.
- Endurecimiento intencional de contrato interno (producto en construcción, sin consumidores externos): `hasInventoryRow` pasa a ser **required** y `updatedAtUtc` se documenta explícitamente como nullable cuando no existe fila real de inventario.

## 2026-02 Release C

- Snapshot POS agrega campos opcionales (`availabilityReason`, `storeOverrideState`, `isInventoryTracked`, `stockOnHandQty`) sin romper campos existentes.
- Nuevos endpoints admin:
  - `GET|PUT|DELETE /api/v1/pos/admin/catalog/store-overrides`
  - `GET|PUT /api/v1/pos/admin/catalog/inventory`


## POS Release C (compat)

Se agregan campos opcionales no rompientes en snapshot (`availabilityReason`, `storeOverrideState`, `isInventoryTracked`, `stockOnHandQty`).
No se removieron rutas ni campos existentes (compatibilidad Release A/B preservada).

## 2026-02-24 — Frontend dual inventory admin endpoint support

- Frontend conserva compatibilidad temporal para inventario admin:
  - Release C: `/api/v1/pos/admin/catalog/inventory`.
  - Legacy: `/api/v1/pos/admin/inventory` (UI de inventario existente).
- El cliente tipa campos opcionales de snapshot Release C (`availabilityReason`, `storeOverrideState`, `isInventoryTracked`, `stockOnHandQty`) sin volverlos obligatorios.

## 2026-02-24 — Inventory admin fallback legado mantenido

- El frontend de Inventory Lite usa por defecto Release C: `/api/v1/pos/admin/catalog/inventory`.
- Se mantiene cliente legacy (`/api/v1/pos/admin/inventory`) solo para compatibilidad temporal en llamadas antiguas.
- Motivo: despliegues graduales donde aún exista consumo histórico del endpoint legado.

## 2026-02-26 — POS inventory Release C.2 reasons extension

- `InventoryAdjustmentReason` se amplía con nuevos valores: `SaleConsumption` y `VoidReversal`.
- Compatibilidad: no se renombraron ni removieron motivos existentes; clientes con enums cerrados deben aceptar valores adicionales en historial/reportes de inventario.

## 2026-02-26 — Frontend inventory history reason fallback (Release C.2)

- Inventory history UI (`/app/admin/pos/inventory`) ahora soporta `SaleConsumption` y `VoidReversal` con etiquetas amigables.
- Compatibilidad: si backend envía un `reason` desconocido en ajustes, frontend renderiza fallback seguro `Otro (<reason>)` sin romper la pantalla.


## 2026-02-26 — POS inventory Release C.2.1 history metadata (backward-compatible)

- `CatalogInventoryAdjustmentDto` agrega campos opcionales: `referenceType`, `referenceId` (`Guid?`), `movementKind`.
- Endpoint impactado: `GET /api/v1/pos/admin/catalog/inventory/adjustments`.
- Fuente de datos: columnas persistidas en `CatalogInventoryAdjustments` (`ReferenceType`, `ReferenceId`, `MovementKind`).
- Compatibilidad: los 3 campos son nullable y se agregaron al final del DTO; clientes legacy pueden ignorarlos.
- Limitación explícita: ajustes manuales históricos o filas sin metadata persistida seguirán devolviendo `null` en estos campos.

## 2026-02-26 — Admin role transition to AdminStore (temporary compatibility)

- Se introduce rol `AdminStore` como nombre objetivo del administrador de sucursal.
- Compatibilidad temporal: policies y guards aceptan `AdminStore` y también `Admin` (legacy) mientras dura la migración.
- Seeder/bootstrapping agrega `AdminStore` y replica membresía desde `Admin` para evitar corte de acceso inmediato.
- Deprecación: `Admin` queda en modo legado y debe removerse en una fase posterior una vez migrados todos los usuarios.
