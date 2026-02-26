# Release C.1 — Inventory Lite Operativo (Backend contract sheet)

## Endpoints

| Method | Path | Policy/Roles |
|---|---|---|
| POST | `/api/v1/pos/admin/catalog/inventory/adjustments` | `TenantOrPlatform` + `PosAdmin` (Admin, Manager, TenantAdmin, SuperAdmin) |
| GET | `/api/v1/pos/admin/catalog/inventory/adjustments` | `TenantOrPlatform` + `PosAdmin` |
| GET | `/api/v1/pos/reports/inventory/current` | `TenantOrPlatform` + `PosReportViewer` (Admin, Manager, TenantAdmin, SuperAdmin) |
| GET | `/api/v1/pos/reports/inventory/low-stock` | `TenantOrPlatform` + `PosReportViewer` |
| GET | `/api/v1/pos/reports/inventory/out-of-stock` | `TenantOrPlatform` + `PosReportViewer` |

## POST adjustments

Request:
- `storeId: guid` (required)
- `itemType: "Product" | "Extra"` (required)
- `itemId: guid` (required)
- `quantityDelta: decimal` (required, `!= 0`)
- `reason: "InitialLoad" | "Purchase" | "Return" | "Waste" | "Damage" | "Correction" | "TransferIn" | "TransferOut" | "ManualCount"`
- `reference?: string`
- `note?: string`
- `clientOperationId?: string` (idempotency key per `tenantId+storeId+clientOperationId`)

Response (`200`): `CatalogInventoryAdjustmentDto`
- `id, storeId, itemType, itemId`
- `qtyBefore, qtyDelta, qtyAfter`
- `reason, reference, note, clientOperationId`
- `createdAtUtc, performedByUserId`
- `itemName?, itemSku?`
- `referenceType?, referenceId?, movementKind?` (opcionales, Release C.2.1; backward-compatible)

## GET adjustments history

Query:
- `storeId` required
- `itemType?`, `itemId?`, `fromUtc?`, `toUtc?`

Response (`200`): `CatalogInventoryAdjustmentDto[]` sorted desc by `createdAtUtc`.

Compatibilidad C.2.1: `referenceType`, `referenceId` (guid nullable) y `movementKind` son opcionales; clientes existentes pueden ignorarlos sin romperse.

## Reports

Shared query:
- `storeId` required
- `itemType?` (`Product|Extra`)
- `search?` (name or sku)

Low-stock extra query:
- `threshold` default = `5` and must be `> 0`.

Response rows (`InventoryReportRowDto[]`):
- `itemType, itemId, itemName, itemSku, storeId`
- `stockOnHandQty, isInventoryTracked`
- `availabilityReason, storeOverrideState`
- `updatedAtUtc, lastAdjustmentAtUtc`

## Validation / errors (ProblemDetails)

- `400 Validation failed`
  - `itemType` invalid or `OptionItem`
  - item not found in tenant template
  - `quantityDelta == 0`
  - `reason` missing/invalid
- `403 Forbidden`
  - cross-tenant store access
  - user role without policy
- `409 Conflict`
  - `reason = "InventoryNotTracked"`
  - `reason = "NegativeStockNotAllowed"`

Common extensions: `traceId`, `correlationId`; for inventory conflicts also `reason`.
