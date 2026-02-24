# POS Sales Backend (Paso 4)

## Endpoints

### Crear venta
`POST /api/v1/pos/sales`

Request ejemplo:
```json
{
  "clientSaleId": "7f2f0eab-2ff7-4e3e-8f3a-07b24fd7c90b",
  "occurredAtUtc": "2026-02-12T16:04:00Z",
  "items": [
    {
      "productId": "8e76bdf9-f73f-4fb4-bcb0-00ea59fd4699",
      "quantity": 2,
      "selections": [
        { "groupKey": "milk", "optionItemId": "5ea79f6e-18d8-4ef2-a0d4-b9b40fd81f07" }
      ],
      "extras": [
        { "extraId": "8fb81ea7-f6d8-4563-9844-5bc96e74cb53", "quantity": 2 }
      ]
    }
  ],
  "payment": {
    "method": "Cash",
    "amount": 170,
    "reference": null
  }
}
```

Response ejemplo:
```json
{
  "saleId": "4b7b5056-f9f5-4da0-b95a-26aa57030f08",
  "folio": "POS-20260212160400123",
  "occurredAtUtc": "2026-02-12T16:04:00+00:00",
  "total": 170.00
}
```

### Resumen diario
`GET /api/v1/pos/reports/daily-summary?date=2026-02-12`

Response:
```json
{
  "date": "2026-02-12",
  "totalTickets": 34,
  "totalAmount": 4860.00,
  "totalItems": 71,
  "avgTicket": 142.94
}
```

### Top productos
`GET /api/v1/pos/reports/top-products?dateFrom=2026-02-01&dateTo=2026-02-12&top=10`

Response:
```json
[
  {
    "productId": "8e76bdf9-f73f-4fb4-bcb0-00ea59fd4699",
    "productNameSnapshot": "Latte",
    "qty": 42,
    "amount": 3150.00
  }
]
```


## Reglas de pago y fecha

- `payment.method` se recibe como string del enum: `Cash`, `Card`, `Transfer`.
- `payment.reference` es **requerido** para `Card` y `Transfer`; para `Cash` es opcional y se ignora en persistencia.
- `occurredAtUtc` es opcional. Si no se envía, el backend asigna `DateTimeOffset.UtcNow` como fuente de verdad.
- `clientSaleId` mantiene idempotencia: si se repite uno existente, se devuelve la venta previamente creada.

## Reglas de snapshot

- El backend resuelve el snapshot de `Product`, `OptionItem` y `Extra` desde catálogo activo al crear la venta.
- `SaleItem` guarda `ProductNameSnapshot`, `ProductExternalCode`, `UnitPriceSnapshot` y `LineTotal`.
- `SaleItemSelection` guarda `GroupKey`, `OptionItemNameSnapshot` y `PriceDeltaSnapshot` (actualmente 0 por defecto).
- `SaleItemExtra` guarda `ExtraNameSnapshot`, `UnitPriceSnapshot`, `Quantity` y `LineTotal`.
- Totales (`Subtotal`/`Total`) se calculan siempre server-side.
- Auditoría: creación de venta genera `AuditLog` con `EntityType=Sale`, `Action=Create`, `EntityId`, `UserId`, `CorrelationId` y resumen JSON en `AfterJson`.

## Notas SQLite para tests

- SQLite puede fallar o comportarse distinto al ordenar directamente por `DateTimeOffset` en EF.
- En pruebas, materializar resultados y ordenar en memoria cuando se requiera orden por fecha/hora offset.


## Reportes operativos v1

La especificación de los nuevos endpoints de reportes POS se documenta en `docs/pos-reports.md`.


## Catálogo y disponibilidad

- El contrato de snapshot de catálogo, caching con ETag y semántica `isActive`/`isAvailable` se documenta en `docs/pos-catalog.md`.
- La creación de venta valida disponibilidad en servidor y devuelve `409 Conflict` cuando un item está temporalmente no disponible.

## Release C availability validation

CreateSale valida disponibilidad efectiva unificada para Product/Extra/OptionItem.

`409` incluye `extensions.itemType`, `extensions.itemId`, `extensions.itemName`, `extensions.reason`.

## Release C - validación de disponibilidad en CreateSale

`POST /api/v1/pos/sales` usa el mismo motor de disponibilidad del snapshot.
Cuando un item no está disponible retorna `409 Conflict` con `ProblemDetails` estable y extensiones:
- `itemType`
- `itemId`
- `itemName` (vacío si no hay)
- `reason` (`DisabledByTenant`, `DisabledByStore`, `ManualUnavailable`, `OutOfStock`)

IDs inválidos o no existentes se mantienen como `400 BadRequest`.
