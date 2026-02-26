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
- DTO historial (C.2.1) agrega metadata opcional/backward-compatible: `referenceType?`, `referenceId?`, `movementKind?`.
- Origen de metadata:
  - Movimientos manuales (`Purchase`, `Correction`, etc.): normalmente `null` en los 3 campos.
  - Movimientos automáticos `SaleConsumption`: `referenceType=Sale`, `referenceId=<saleId>`, `movementKind=SaleConsumption`.
  - Movimientos automáticos `VoidReversal`: `referenceType=SaleVoid`, `referenceId=<saleId>`, `movementKind=VoidReversal`.

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


## Frontend usage C.1
- Pantalla admin: `/app/admin/pos/inventory` incluye formulario `Nuevo ajuste` (`data-testid=inventory-adjust-*`) y tabla de historial (`inventory-history-*`).
- El submit manda `clientOperationId` UUID para idempotencia y maneja conflictos `409` con reason code estable (`InventoryNotTracked`, `NegativeStockNotAllowed`) en `inventory-adjust-error`.
- Filtros de historial FE: `storeId` (requerido), `itemType`, `itemId`, `reason`, `fromUtc`, `toUtc`; la consulta usa `GET /api/v1/pos/admin/catalog/inventory/adjustments`.
- Pantalla reportes: `/app/pos/reportes` agrega bloques `report-inventory-current`, `report-inventory-low` y `report-inventory-out` con filtros `storeId`, `itemType`, `search` y `threshold` (solo low-stock).
- Cada bloque tiene error aislado (`report-error-inventory-current|low|out`) para no bloquear toda la pantalla.
- UI historial C.2.1: prioriza `movementKind` cuando viene (`SaleConsumption`/`VoidReversal`) para etiqueta amigable y badges estables (`inventory-history-badge-sale-consumption`, `inventory-history-badge-void-reversal`).
- Referencias C.2.1 en FE: si vienen `referenceType` + `referenceId`, se renderiza formato amigable `<referenceType>: <referenceId>` en `inventory-history-reference-{id}`; si no, fallback al `reference` legacy y finalmente `—`.
- Compat/hardening FE: si `movementKind` viene `null`, se mantiene formatter por `reason`; si llega un valor desconocido, renderiza fallback seguro `Otro (<valor>)` + `inventory-history-badge-unknown` sin romper la tabla.

## Release C.2 — consumo automático por venta + reversa por void

### Nuevos reasons en historial

- `SaleConsumption`: movimiento automático negativo al confirmar venta.
- `VoidReversal`: movimiento automático positivo al anular (void) una venta.

### Reglas de consumo

- Solo consumen inventario:
  - `Product` tracked (`IsInventoryTracked=true`)
  - `Extra` tracked (`IsInventoryTracked=true`)
- `OptionItem` no consume inventario en C.2.
- Extras: se consume `SaleItemExtra.Quantity` (cantidad explícita del extra en la línea de venta).

### Idempotencia y referencias

- Los movimientos automáticos registran referencia estable internamente:
  - consumo: `ReferenceType=Sale`, `ReferenceId={saleId}`
  - reversa: `ReferenceType=SaleVoid`, `ReferenceId={saleId}`
- **Contrato DTO C.2.1 (GET/POST adjustments):** mantiene `reference` y además expone opcionalmente `referenceType`, `referenceId` y `movementKind` (backward-compatible).
- Se agrega unicidad para evitar duplicados por reintentos en venta/void por item de inventario.
