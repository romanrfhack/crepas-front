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
  {
    "reasonCode": "CashierError",
    "reasonText": "captura",
    "count": 1,
    "amount": 50
  }
]
```

### 7) Top products (extensión compatible)

`GET /api/v1/pos/reports/top-products?dateFrom=2026-03-01&dateTo=2026-03-02&top=10&storeId=<guid>&cashierUserId=<guid>&shiftId=<guid>`

- Filtros nuevos opcionales: `storeId`, `cashierUserId`, `shiftId`.
- Si no se envían, se preserva el comportamiento previo (rango + top).

## v2 endpoints (operativos extendidos)

Los endpoints siguientes se exponen también bajo `GET /api/v1/pos/reports/*` y **no rompen v1**.

### Cálculo de `grossSales` (v2)

Para mix por categoría/producto:

- `base = SaleItems.LineTotal`
- `extras = SUM(SaleItemExtras.LineTotal)` por `SaleItemId`
- `selectionsImpact = SUM(SaleItemSelections.PriceDeltaSnapshot * SaleItems.Quantity)` por `SaleItemId`
- `grossLine = base + extras + selectionsImpact`

Notas:

- Se excluyen ventas `Status=Void` de métricas de ventas/pagos.
- Las fechas `dateFrom/dateTo` se interpretan en zona local del store (`Store.TimeZoneId`) y luego se convierten a UTC para filtrar.

### 8) Mix de ventas por categoría

`GET /api/v1/pos/reports/sales/categories?dateFrom=2026-04-01&dateTo=2026-04-02&storeId=<guid>&cashierUserId=<guid>&shiftId=<guid>`

```json
{
  "items": [
    {
      "categoryId": "<guid>",
      "categoryName": "Bebidas",
      "tickets": 12,
      "quantity": 21,
      "grossSales": 3560.0
    }
  ]
}
```

### 9) Mix de ventas por producto

`GET /api/v1/pos/reports/sales/products?dateFrom=2026-04-01&dateTo=2026-04-02&storeId=<guid>&top=20`

```json
{
  "items": [
    {
      "productId": "<guid>",
      "sku": "P-A",
      "productName": "Producto A",
      "tickets": 8,
      "quantity": 14,
      "grossSales": 1820.0
    }
  ]
}
```

### 10) Add-ons: extras más vendidos

`GET /api/v1/pos/reports/sales/addons/extras?dateFrom=2026-04-01&dateTo=2026-04-02&storeId=<guid>&top=20`

```json
{
  "items": [
    {
      "extraId": "<guid>",
      "extraSku": "<guid>",
      "extraName": "Queso extra",
      "quantity": 18,
      "grossSales": 360.0
    }
  ]
}
```

### 11) Add-ons: opciones más usadas

`GET /api/v1/pos/reports/sales/addons/options?dateFrom=2026-04-01&dateTo=2026-04-02&storeId=<guid>&top=20`

```json
{
  "items": [
    {
      "optionItemId": "<guid>",
      "optionItemSku": "<guid>",
      "optionItemName": "Salsa especial",
      "usageCount": 11,
      "grossImpact": 220.0
    }
  ]
}
```

### 12) KPIs operativos resumidos

`GET /api/v1/pos/reports/kpis/summary?dateFrom=2026-04-01&dateTo=2026-04-02&storeId=<guid>`

```json
{
  "tickets": 42,
  "totalItems": 97,
  "grossSales": 10240.0,
  "avgTicket": 243.81,
  "avgItemsPerTicket": 2.31,
  "voidCount": 3,
  "voidRate": 0.0667
}
```

### 13) Control de diferencias de caja

`GET /api/v1/pos/reports/control/cash-differences?dateFrom=2026-04-01&dateTo=2026-04-02&storeId=<guid>&cashierUserId=<guid>`

```json
{
  "daily": [
    {
      "date": "2026-04-01",
      "cashierUserId": "<guid>",
      "shifts": 1,
      "expectedCash": 1000.0,
      "countedCash": 980.0,
      "difference": -20.0,
      "reasonCount": 1
    }
  ],
  "shifts": [
    {
      "shiftId": "<guid>",
      "openedAt": "2026-04-01T14:00:00Z",
      "closedAt": "2026-04-01T22:00:00Z",
      "cashierUserId": "<guid>",
      "cashierUserName": "usuario.caja",
      "expectedCash": 1000.0,
      "countedCash": 980.0,
      "difference": -20.0,
      "closeReason": "Short"
    }
  ]
}
```

- `cashierUserName` es opcional y se incluye para renderizar el nombre de usuario del cajero.
- Compatibilidad: `cashierUserId` se mantiene en el contrato; UI debe usar fallback a `cashierUserId` cuando `cashierUserName` venga vacío o ausente.

## Frontend usage (Dashboard Reportes Operativos v1)

- Pantalla: `/app/pos/reportes`.
- Filtros UI: `dateFrom`, `dateTo`, `cashierUserId`, `shiftId`.
- Si no se selecciona tienda en UI, se usa `StoreContextService.getActiveStoreId()` y se envía como `storeId`.
- Rango por defecto recomendado en UI: últimos 7 días en zona horaria de negocio (`America/Mexico_City`) usando `PosTimezoneService`.
- La UI usa selectores `data-testid` estables para contrato E2E (filtros y tablas de salida).

## Frontend usage v2 (Dashboard extendido)

- Pantalla: `/app/pos/reportes` mantiene bloques v1 y agrega secciones v2 sin romper compatibilidad.
- Filtros compartidos: `dateFrom`, `dateTo`, `cashierUserId`, `shiftId`; botón **Recargar** vuelve a consultar v1 + v2.
- Resolución de `storeId` en frontend:
  1. `storeId` explícito (si algún consumidor lo envía),
  2. `StoreContextService.getActiveStoreId()`,
  3. omitido para fallback backend (`DefaultStoreId`).
- KPIs y tablas v2 se renderizan con fallback visual (`—` o tabla vacía) y error por bloque (`report-error-*`) sin bloquear toda la pantalla.

### Endpoints v2 consumidos por FE

- `GET /api/v1/pos/reports/kpis/summary?dateFrom&dateTo&storeId?&cashierUserId?&shiftId?`
- `GET /api/v1/pos/reports/sales/categories?dateFrom&dateTo&storeId?&cashierUserId?&shiftId?`
- `GET /api/v1/pos/reports/sales/products?dateFrom&dateTo&storeId?&cashierUserId?&shiftId?&top?`
- `GET /api/v1/pos/reports/sales/addons/extras?dateFrom&dateTo&storeId?&cashierUserId?&shiftId?&top?`
- `GET /api/v1/pos/reports/sales/addons/options?dateFrom&dateTo&storeId?&cashierUserId?&shiftId?&top?`
- `GET /api/v1/pos/reports/control/cash-differences?dateFrom&dateTo&storeId?&cashierUserId?`

### `data-testid` relevantes (v2)

- KPIs: `kpi-gross-sales`, `kpi-tickets`, `kpi-avg-ticket`, `kpi-avg-items-per-ticket`, `kpi-void-rate`.
- Mix por categorías: `mix-categories-table`, `mix-category-row-{i}`.
- Mix por productos: `mix-products-table`, `mix-product-row-{i}`.
- Add-ons: `addons-extras-table`, `addons-options-table`.
- Control de caja: `cash-diff-table`, `cash-diff-row-{i}`.
- Errores por bloque: `report-error-kpis`, `report-error-mixCategories`, `report-error-mixProducts`, `report-error-addonsExtras`, `report-error-addonsOptions`, `report-error-cashDifferences`.
