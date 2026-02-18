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
