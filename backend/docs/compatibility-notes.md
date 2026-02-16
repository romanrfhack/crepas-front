# POS Compatibility Notes

## Release 1 - Operación de caja completa

### `POST /api/v1/pos/sales`
- New contract supports `payments[]` for mixed payments.
- Backward compatibility: existing `payment` (single object) is still accepted and mapped as one element.
- New optional `storeId` field.

### `POST /api/v1/pos/sales/{saleId}/void`
- New endpoint for sale cancellation.
- Supports `reasonCode`, `reasonText`, `note`, and optional `clientVoidId` for idempotency.

### Shift endpoints
- `POST /api/v1/pos/shifts/open`: accepts optional `storeId`.
- `GET /api/v1/pos/shifts/current?storeId={guid}`: optional store scope.
- `GET /api/v1/pos/shifts/close-preview`: backward compatible preview without counted cash.
- `POST /api/v1/pos/shifts/close-preview`: v2 preview with optional counted cash input.
- `POST /api/v1/pos/shifts/close`: accepts optional `shiftId`, optional `countedDenominations`, optional `closeReason`, optional `storeId`.

### Business day and timezone
- Business day calculations and reporting groupings now use local time in `America/Mexico_City`.
- Timestamps remain persisted in UTC.
