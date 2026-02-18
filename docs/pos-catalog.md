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
- Header `ETag` débil derivado de:
  - `MAX(UpdatedAtUtc)` entre `Categories`, `Products`, `Extras`, `OptionSets`, `OptionItems`.
  - Conteos de esas tablas para evitar colisiones triviales.
- Si el cliente manda `If-None-Match` igual al ETag vigente, el endpoint responde `304 Not Modified` sin body.

## Validación de disponibilidad al crear venta

`POST /api/v1/pos/sales` valida en servidor:
- Producto activo + disponible.
- Extras activos + disponibles.
- OptionItems activos + disponibles.

Errores:
- No disponible: `409 Conflict` con extensiones `itemType`, `itemId` y opcional `itemName`.
- IDs inexistentes/inactivos: `400 ValidationProblemDetails` con errores por campo.
