# Release C — Contract sheet (Inventory + POS stock gating)

## POS Admin Inventory

Base: `/api/v1/pos/admin` (Bearer + `TenantOrPlatform` + `PosAdmin`, tenant required)

| Method | Route | Body / Query | Response |
|---|---|---|---|
| GET | `/inventory?storeId={guid}&search={term?}` | Query `storeId` requerido | `200` → `StoreInventoryItemDto[]` |
| PUT | `/inventory` | `{ storeId, productId, onHand }` | `200` → `StoreInventoryItemDto` |
| PUT | `/inventory/settings` | `{ showOnlyInStock }` | `200` → `PosInventorySettingsDto` |

`StoreInventoryItemDto`:
- `storeId`
- `productId`
- `productName`
- `productSku`
- `onHand`
- `reserved`
- `updatedAtUtc`

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
