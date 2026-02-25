# POS Catálogo y disponibilidad (v1)

## IsActive vs IsAvailable

- `isActive`: habilitación estructural del catálogo (alta/baja administrativa).
- `isAvailable`: disponibilidad operativa en tiempo real (ej. se acabó fresa/nutella).

En esta versión, `isAvailable` existe en:

- `Product`
- `Extra`
- `OptionItem`

## Snapshot de catálogo para POS

Endpoint:

- `GET /api/v1/pos/catalog/snapshot?storeId={optional}`

Respuesta (resumen):

- `storeId`
- `timeZoneId`
- `generatedAtUtc`
- `catalogVersion`
- `etagSeed`
- Secciones de catálogo actuales (`categories`, `products`, `extras`, `optionSets`, `optionItems`, `schemas`, `selectionGroups`, `includedItems`, `overrides`)

### Caching / ETag

- Header `Cache-Control: public, max-age=60`.
- Header `ETag` débil derivado de un hash SHA-256 del contenido relevante del catálogo (ordenado por `Id`) para evitar falsos `304`:
  - `Categories`, `Products`, `Extras`, `OptionSets`, `OptionItems`.
  - `Schemas`, `SelectionGroups`, `IncludedItems`, `Overrides` y `OverrideAllowedItems`.
  - Incluye campos de disponibilidad (`isAvailable`) y demás campos funcionales de cada sección.
- Si el cliente manda `If-None-Match` igual al ETag vigente, el endpoint responde `304 Not Modified` sin body.

## Frontend usage (POS)

- El frontend consume `GET /api/v1/pos/catalog/snapshot` mediante un servicio dedicado (`PosCatalogSnapshotService`).
- Estrategia de cache en cliente:
  - Persistencia en `localStorage` por alcance de tienda (`storeId`) con entrada separada para `default`.
  - Primer `GET`: guarda `snapshot + etag`.
  - Siguientes `GET`: envía `If-None-Match` con el ETag guardado.
  - `304 Not Modified`: reutiliza snapshot cacheado tipado.
  - `200 OK`: reemplaza snapshot cacheado + ETag.
- Scoping de tienda (`storeId`) en frontend:
  1. `storeId` explícito de la llamada.
  2. `StoreContextService.activeStoreId`.
  3. omitido (backend resuelve tienda por defecto).

## UX de disponibilidad en POS

- Productos `isAvailable=false` se muestran `disabled` con badge **Agotado** y bloqueo duro de click.
- Extras y OptionItems `isAvailable=false` se muestran deshabilitados en modal de personalización.
- Además del bloqueo UI, se mantiene validación server-side por si el snapshot local está stale.

### Fallback cuando backend devuelve 409 ItemUnavailable

- Si `POST /api/v1/pos/sales` devuelve `409` con `itemType/itemId/itemName`, la UI muestra:
  - `No disponible: {itemName}`
  - acción “Actualizar catálogo”.
- Al confirmar actualización:
  - `invalidate()` del cache de snapshot,
  - `getSnapshot({ forceRefresh: true })`,
  - rerender del catálogo para reflejar disponibilidad real.

## Validación de disponibilidad al crear venta

`POST /api/v1/pos/sales` valida en servidor:

- Producto activo + disponible.
- Extras activos + disponibles.
- OptionItems activos + disponibles.

Errores:

- No disponible: `409 Conflict` con `ProblemDetails` y extensiones **siempre presentes**:
  - `itemType`: `"Product" | "Extra" | "OptionItem"`
  - `itemId`: `UUID` en formato canónico (`D`)
  - `itemName`: nombre del ítem; si no existe, string vacío (`""`)
- IDs inexistentes/inactivos: `400 ValidationProblemDetails` con errores por campo.

## Flujo stale cache -> refresh (contrato UI↔API)

1. El POS puede iniciar con snapshot cacheado por tienda (`pos_catalog_snapshot_cache:{storeId|default}`).
2. Si ese snapshot queda stale, `POST /api/v1/pos/sales` puede responder `409 ItemUnavailable`.
3. La UI muestra mensaje claro con `itemName` y habilita el CTA **Actualizar catálogo**.
4. Al presionar CTA, frontend invalida el cache scoped de la tienda activa y fuerza `getSnapshot({ forceRefresh: true })`.
5. La UI se vuelve a renderizar con el snapshot actualizado (incluyendo `isAvailable=false` en el ítem agotado).

### Referencia de pruebas

- Backend integration snapshot/etag: `backend/tests/CobranzaDigital.Api.Tests/PosCatalogIntegrationTests.cs`.
- Backend integration 409 `ItemUnavailable`: `backend/tests/CobranzaDigital.Api.Tests/PosSalesIntegrationTests.cs`.
- Frontend unit cache por store: `frontend/src/app/features/pos/services/pos-catalog-snapshot.service.spec.ts`.
- Frontend unit UX 409: `frontend/src/app/features/pos/pages/pos-caja.page.spec.ts`.
- Frontend E2E stale-cache/refresh: `frontend/e2e/pos.release1.contract.spec.ts`.

## Release B: Template + Tenant Overrides + Store Availability

- **CatalogTemplate** es la fuente maestra por vertical.
- Cada tenant se asocia a un template activo con `TenantCatalogTemplate`.
- **TenantCatalogOverrides** permite habilitar/deshabilitar `Product|Extra|OptionItem` sin duplicar catálogo.
- **StoreCatalogAvailability** permite marcar disponibilidad operativa por tienda.

### Snapshot

`GET /api/v1/pos/catalog/snapshot` mantiene el contrato existente y ahora agrega `tenantId`, `verticalId` y `catalogTemplateId`.

Composición:
1. Catálogo base del template del tenant.
2. Se excluyen ítems con override `isEnabled=false`.
3. `isAvailable` final usa `StoreCatalogAvailability`; si no hay override, usa `IsAvailable` base.

### Reglas de venta (409)

- `reason=DisabledByTenant`: item deshabilitado por override de tenant.
- `reason=UnavailableInStore`: item no disponible por tienda (o base `IsAvailable=false`).
- El payload de conflicto mantiene `itemType`, `itemId`, `itemName` y agrega `reason`.

## Release C (backend)

- Se agregan endpoints tenant-scoped para `store-overrides` con estados explícitos `Enabled|Disabled` y soporte de eliminación de override (vuelve a herencia).
- Se agregan campos opcionales en snapshot para disponibilidad efectiva: `availabilityReason`, `storeOverrideState`, `isInventoryTracked`, `stockOnHandQty`.
- Nueva precedencia efectiva: disabled tenant/store > manual availability false > stock (cuando tracked) > default.

## Release C disponibilidad efectiva (store + inventory lite)

Se resuelve con precedencia estable por tienda para `Product`, `Extra` y `OptionItem`:
1. `DisabledByTenant`
2. `DisabledByStore`
3. `ManualUnavailable` (`IsAvailable=false`)
4. `OutOfStock` (solo `Product` y `Extra` con `IsInventoryTracked=true` y `stock<=0`)
5. disponible (`Available` o `EnabledByStore`)

`GET /api/v1/pos/catalog/snapshot` agrega campos opcionales no rompientes por ítem:
- `availabilityReason`
- `storeOverrideState`
- `isInventoryTracked` (Product/Extra)
- `stockOnHandQty` (Product/Extra)

El ETag del snapshot cambia también cuando cambian overrides tenant/store, inventario lite y disponibilidad manual base.

## Release C frontend (store overrides + inventory lite)

Fuente de verdad backend (`PosAdminCatalogController`):
- `GET /api/v1/pos/admin/catalog/store-overrides?storeId={storeId}&itemType={type}&onlyOverrides={bool}`
- `PUT /api/v1/pos/admin/catalog/store-overrides`
- `DELETE /api/v1/pos/admin/catalog/store-overrides?storeId={storeId}&itemType={type}&itemId={itemId}`
- `GET /api/v1/pos/admin/catalog/inventory?storeId={storeId}&itemType={type?}&itemId={itemId?}&onlyTracked={bool}`
- `PUT /api/v1/pos/admin/catalog/inventory`

Snapshot POS mantiene compatibilidad backward agregando opcionales:
`availabilityReason`, `storeOverrideState`, `isInventoryTracked`, `stockOnHandQty`.

### Test IDs estables Release C
- `availability-badge-{type}-{id}`
- `unavailable-alert`
- `unavailable-message`
- `unavailable-item-name`
- `refresh-catalog-unavailable`

## Release C frontend admin UI (operable)

- Ruta admin: `/app/admin/pos/overrides`.
- Flujo mínimo:
  - Capturar `storeId` (`data-testid="store-override-store-select"`).
  - Renderizar filas para `Product`, `Extra`, `OptionItem`.
  - Mostrar estado por fila: `Sin override`, `Enabled`, `Disabled` (`store-override-state-{type}-{id}`).
  - Acciones por fila:
    - `store-override-enable-{type}-{id}` → `PUT /api/v1/pos/admin/catalog/store-overrides` con `state=Enabled`.
    - `store-override-disable-{type}-{id}` → `PUT ...` con `state=Disabled`.
    - `store-override-clear-{type}-{id}` → `DELETE /api/v1/pos/admin/catalog/store-overrides?...`.
- UX:
  - loading por fila durante guardado,
  - rollback visual si la mutación falla,
  - errores por fila y mensaje global con copy estable.


## Referencias Release C.1
- `docs/pos-inventory-lite.md`
- `docs/release-c1-inventory-contract-sheet.md`
