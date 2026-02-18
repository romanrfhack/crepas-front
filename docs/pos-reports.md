# POS Reportes operativos v1

Base path: `GET /api/v1/pos/reports/*`

## Reglas generales

- Acceso: roles `Admin` y `Manager`.
- Si `storeId` se omite, el backend resuelve `DefaultStoreId` desde configuración POS.
- Rango `dateFrom/dateTo` se interpreta en **fecha local del store** (`Store.TimeZoneId`), se convierte a UTC para filtrar por `Sales.OccurredAtUtc` con rango `[utcStart, utcEndExclusive)`.
- `totalSales` y agregados de `payments` excluyen ventas voided.
- `voids` incluye únicamente ventas voided (`Status=Void` / `VoidedAtUtc != null`).

## Endpoints

### 1) Ventas diarias
`GET /api/v1/pos/reports/sales/daily?dateFrom=2026-03-01&dateTo=2026-03-02&storeId=<guid>`

```json
[
  {
    "businessDate": "2026-03-01",
    "tickets": 2,
    "subtotal": 160,
    "discounts": 0,
    "tax": 0,
    "totalSales": 160,
    "avgTicket": 80,
    "voidsCount": 0,
    "voidsTotal": 0,
    "payments": { "cash": 100, "card": 60, "transfer": 0 }
  }
]
```

### 2) Pagos por método
`GET /api/v1/pos/reports/payments/methods?dateFrom=2026-03-01&dateTo=2026-03-02&storeId=<guid>`

```json
{
  "dateFrom": "2026-03-01",
  "dateTo": "2026-03-02",
  "totals": [
    { "method": "Cash", "count": 1, "amount": 100 },
    { "method": "Card", "count": 1, "amount": 60 },
    { "method": "Transfer", "count": 1, "amount": 80 }
  ]
}
```

### 3) Ventas por hora
`GET /api/v1/pos/reports/sales/hourly?dateFrom=2026-03-01&dateTo=2026-03-02&storeId=<guid>`

```json
[
  { "hour": 9, "tickets": 1, "totalSales": 100 },
  { "hour": 10, "tickets": 1, "totalSales": 60 }
]
```

### 4) Ventas por cajero
`GET /api/v1/pos/reports/sales/cashiers?dateFrom=2026-03-01&dateTo=2026-03-02&storeId=<guid>`

```json
[
  {
    "cashierUserId": "<guid>",
    "tickets": 2,
    "totalSales": 180,
    "avgTicket": 90,
    "voidsCount": 0,
    "voidsTotal": 0,
    "payments": { "cash": 100, "card": 0, "transfer": 80 }
  }
]
```

### 5) Resumen de turnos
`GET /api/v1/pos/reports/shifts/summary?dateFrom=2026-03-01&dateTo=2026-03-02&storeId=<guid>&cashierUserId=<guid>`

```json
[
  {
    "shiftId": "<guid>",
    "cashierUserId": "<guid>",
    "openedAtUtc": "2026-03-01T14:00:00Z",
    "closedAtUtc": "2026-03-01T22:00:00Z",
    "closeReason": null,
    "tickets": 2,
    "totalSales": 160,
    "payments": { "cash": 100, "card": 60, "transfer": 0 },
    "closingExpectedCashAmount": 100,
    "closingCountedCashAmount": 100,
    "cashDifference": 0
  }
]
```

### 6) Razones de void
`GET /api/v1/pos/reports/voids/reasons?dateFrom=2026-03-01&dateTo=2026-03-02&storeId=<guid>`

```json
[
  { "reasonCode": "CashierError", "reasonText": "captura", "count": 1, "amount": 50 }
]
```

### 7) Top products (extensión compatible)
`GET /api/v1/pos/reports/top-products?dateFrom=2026-03-01&dateTo=2026-03-02&top=10&storeId=<guid>&cashierUserId=<guid>&shiftId=<guid>`

- Filtros nuevos opcionales: `storeId`, `cashierUserId`, `shiftId`.
- Si no se envían, se preserva el comportamiento previo (rango + top).
