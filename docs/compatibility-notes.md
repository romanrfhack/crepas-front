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
