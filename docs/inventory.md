# Inventory (Release C)

## Modelo

Se agrega `StoreInventories` con PK compuesta `(StoreId, ProductId)` para manejar inventario ligero por sucursal y producto template.

Campos:
- `StoreId` (FK `Stores`)
- `ProductId` (FK `Products` del template)
- `OnHand` (`decimal(18,3)`)
- `Reserved` (`decimal(18,3)`, default `0`)
- `UpdatedAtUtc`
- `UpdatedByUserId` (nullable)
- `RowVersion` (concurrency token)

También se agrega `PosSettings.ShowOnlyInStock` (`bool`, default `false`).

## Regla `ShowOnlyInStock`

- `false`:
  - Snapshot no filtra por inventario.
  - `CreateSale` no bloquea por stock, aunque exista `OnHand = 0`.
- `true`:
  - Snapshot sólo incluye productos `enabled + available + onHand > 0`.
  - Si un producto no tiene fila en `StoreInventories`, se trata como `0`.
  - `CreateSale` valida stock suficiente y, si no alcanza, responde `409`.

## Efecto en Snapshot

Endpoint: `GET /api/v1/pos/catalog/snapshot`

Con `ShowOnlyInStock=true`, productos con `OnHand<=0` no aparecen en `products[]`.

## Efecto en CreateSale

Endpoint: `POST /api/v1/pos/sales`

Orden de validación:
1. ownership/template/override/availability
2. stock (sólo con `ShowOnlyInStock=true`)

En venta confirmada, se descuenta `OnHand` por producto dentro de la misma transacción de la venta.

## Error 409 OutOfStock

Cuando no hay inventario suficiente:
- `status`: 409
- `title`: `Conflict`
- Extensions:
  - `itemType`: `Product`
  - `itemId`
  - `itemName`
  - `reason`: `OutOfStock`
  - `availableQty`: cantidad disponible actual


## Inventario Admin (GET /api/v1/pos/admin/inventory)

- Lista todos los productos activos del template del tenant para la sucursal solicitada, respetando overrides `DisabledByTenant`.
- Hace left join con `StoreInventories` por `(StoreId, ProductId)`.
- Si no existe fila de inventario: `onHand=0`, `reserved=0`, `updatedAtUtc=null`, `hasInventoryRow=false`.
- `search` filtra por `productName` o `productSku` del template.
- `onlyWithStock=true` (opcional) filtra resultados con `onHand > 0` para soporte de UI admin.
