# POS Inventory Lite v1 / Release C.1

## Alcance
- Inventariable: `Product` y `Extra` con `IsInventoryTracked=true`.
- `OptionItem` no inventariable (rechazo estable 400).
- Persistencia operativa:
  - `CatalogInventoryBalances` (saldo actual)
  - `CatalogInventoryAdjustments` (historial de movimientos)

## Ajustes operativos

### Endpoint
- `POST /api/v1/pos/admin/catalog/inventory/adjustments`

### Motivos soportados (estables)
- `InitialLoad`, `Purchase`, `Return`, `Waste`, `Damage`, `Correction`, `TransferIn`, `TransferOut`, `ManualCount`.

### Reglas
1. `itemType` permitido: `Product|Extra`.
2. `itemId` debe existir dentro del template efectivo del tenant.
3. `IsInventoryTracked=true` (si no: `409` con `reason=InventoryNotTracked`).
4. `quantityDelta != 0`.
5. `reason` requerido y válido.
6. No se permite stock negativo (`409` con `reason=NegativeStockNotAllowed`).
7. `clientOperationId` opcional con idempotencia por `tenantId+storeId+clientOperationId`.

### Auditoría
- Acción: `AdjustInventory`.
- Metadata: tenant/store/item/qtyBefore/qtyDelta/qtyAfter/reason y usuario.

## Historial de movimientos
- `GET /api/v1/pos/admin/catalog/inventory/adjustments`
- Filtros: `storeId` (req), `itemType?`, `itemId?`, `fromUtc?`, `toUtc?`.

## Reportes de inventory

- `GET /api/v1/pos/reports/inventory/current`
- `GET /api/v1/pos/reports/inventory/low-stock?threshold=5`
- `GET /api/v1/pos/reports/inventory/out-of-stock`

Campos por fila:
`itemType, itemId, itemName, itemSku, storeId, stockOnHandQty, isInventoryTracked, availabilityReason, storeOverrideState, updatedAtUtc, lastAdjustmentAtUtc`.

## Multi-tenant / SuperAdmin
- Tenant-scoped estricto por `storeId`.
- `SuperAdmin` puede operar con tenant efectivo vía `X-Tenant-Id`.
- `Cashier` no tiene permisos de admin/reportes de inventario.
