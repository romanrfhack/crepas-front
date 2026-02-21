# Release C — Contract sheet (Inventory + POS stock gating)

## POS Admin Inventory

Base: `/api/v1/pos/admin` (Bearer + `TenantOrPlatform` + `PosAdmin`, tenant required)

| Method | Route | Body / Query | Response |
|---|---|---|---|
| GET | `/inventory?storeId={guid}&search={term?}&onlyWithStock={bool?}` | Query `storeId` requerido; `onlyWithStock` opcional (default `false`) | `200` → `StoreInventoryItemDto[]` |
| PUT | `/inventory` | `{ storeId, productId, onHand }` | `200` → `StoreInventoryItemDto` |
| PUT | `/inventory/settings` | `{ showOnlyInStock }` | `200` → `PosInventorySettingsDto` |

`StoreInventoryItemDto`:
- `storeId`
- `productId`
- `productName`
- `productSku`
- `onHand`
- `reserved`
- `updatedAtUtc` (`null` cuando no existe fila en `StoreInventories`)
- `hasInventoryRow` (obligatorio; `false` cuando no existe fila)

## POS Snapshot

`GET /api/v1/pos/catalog/snapshot`

Cambio de contrato/regla:
- cuando `ShowOnlyInStock=true`, `products[]` excluye productos con inventario faltante/cero.

## POS Sales

`POST /api/v1/pos/sales`

Nuevo conflicto de disponibilidad:
- `409` con `reason=OutOfStock`
- `ProblemDetails.Extensions` agrega:
  - `itemType`
  - `itemId`
  - `itemName`
  - `reason`
  - `availableQty`


Notas de contrato de inventario admin:
- El GET de inventario ahora devuelve **todos los productos activos del template del tenant** (excluyendo `DisabledByTenant`).
- Si un producto no tiene fila en `StoreInventories`, se retorna con `onHand=0`, `reserved=0`, `updatedAtUtc=null` y `hasInventoryRow=false`.
