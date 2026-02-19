# Reportes POS disponibles para Dashboard

## Fuentes de datos y visualizaciones sugeridas

| Nombre del reporte                   | Fuente de datos                                                                                                         | Estructura de datos disponible                                                                   | Estructura sugerida para gráfica                                              | Posibles gráficas sugeridas                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Ventas diarias                       | `PosReportsApiService.getDailySales(filters)`                                                                           | `DailySalesReportItemDto[]` con `businessDate`, `tickets`, `totalSales`, `avgTicket`, `payments` | `{ name: businessDate, value: totalSales }[]` y serie secundaria para tickets | Barras verticales (ventas por día), línea dual (ventas vs tickets), área acumulada |
| Ventas por hora                      | `PosReportsApiService.getHourlySales(filters)`                                                                          | `HourlySalesReportItemDto[]` con `hour`, `tickets`, `totalSales`                                 | `{ name: "08:00", value: totalSales }[]`                                      | Barras por hora, línea de tendencia intra-día                                      |
| Métodos de pago                      | `PosReportsApiService.getPaymentsByMethod(filters)`                                                                     | `PaymentsByMethodSummaryDto` con `totals[]` (`method`, `count`, `amount`)                        | `{ name: method, value: amount }[]`                                           | Pastel / dona (participación de cobros), barras apiladas por monto y cantidad      |
| Top productos                        | `PosReportsApiService.getTopProducts({ ...filters, top })` y `PosSalesApiService.getTopProducts(dateFrom, dateTo, top)` | `TopProductReportItemDto[]` / `TopProductDto[]` con `productName`, `qty`, `amount`               | `{ name: productName, value: amount }[]` o `{ name, value: qty }[]`           | Barras horizontales (Top 5 o Top 10), treemap                                      |
| KPI resumen                          | `PosReportsApiService.getKpisSummary(filters)`                                                                          | `KpisSummaryDto` (`grossSales`, `tickets`, `avgTicket`, `voidRate`, etc.)                        | tarjetas KPI + gauges pequeños                                                | Tarjetas KPI, bullet charts para `voidRate` y `avgItemsPerTicket`                  |
| Mix por categoría                    | `PosReportsApiService.getSalesMixByCategories(filters)`                                                                 | `SalesMixByCategoriesDto.items[]` con `categoryName`, `quantity`, `grossSales`                   | `{ name: categoryName, value: grossSales }[]`                                 | Pie/dona por participación, barras horizontales                                    |
| Mix por producto                     | `PosReportsApiService.getSalesMixByProducts({ ...filters, top })`                                                       | `SalesMixByProductsDto.items[]` con `productName`, `quantity`, `grossSales`                      | `{ name: productName, value: grossSales }[]`                                  | Barras horizontales (Top N), heatmap por volumen                                   |
| Uso de extras                        | `PosReportsApiService.getAddonsExtrasUsage({ ...filters, top })`                                                        | `AddonsExtrasUsageDto.items[]` con `extraName`, `quantity`, `grossSales`                         | `{ name: extraName, value: quantity }[]`                                      | Barras horizontales, pareto de extras                                              |
| Uso de opciones                      | `PosReportsApiService.getAddonsOptionsUsage({ ...filters, top })`                                                       | `AddonsOptionsUsageDto.items[]` con `optionItemName`, `usageCount`, `grossImpact`                | `{ name: optionItemName, value: usageCount }[]`                               | Barras horizontales, nube/treemap                                                  |
| Motivos de anulación                 | `PosReportsApiService.getVoidReasons(filters)`                                                                          | `VoidReasonReportItemDto[]` con `reasonText`, `count`, `amount`                                  | `{ name: reasonText, value: count }[]`                                        | Barras por motivo, pastel de distribución                                          |
| Diferencias de caja                  | `PosReportsApiService.getCashDifferencesControl(filters)`                                                               | `CashDifferencesControlDto.daily[]` y `shifts[]` con `difference`, `expectedCash`, `countedCash` | `{ name: date o shiftId, value: difference }[]`                               | Barras divergentes (positivo/negativo), tabla de alertas                           |
| Ventas del turno actual (flujo caja) | `PosCajaPage.shiftSales` (signal local actualizado tras `createSale` y `voidSale`)                                      | `SaleListItemUi[]` con `folio`, `total`, `occurredAtUtc`, `status`                               | agregado por hora/estado en UI (`{ name, value }[]`)                          | Línea/barras de ventas del turno en tiempo real, donut de estatus `Completed/Void` |

## Propuesta inicial (primeras 3 gráficas para implementar)

1. **Métodos de pago (pastel/dona)**
   - Fuente: `getPaymentsByMethod`.
   - Valor: participación de `amount` por método.
   - Valor de negocio: lectura rápida de mix de cobro.

2. **Top 5 productos (barras horizontales)**
   - Fuente: `getTopProducts`.
   - Valor: `amount` por producto (con toggle opcional a `qty`).
   - Valor de negocio: identifica productos estrella y oportunidad de upsell.

3. **Ventas por hora (barras verticales)**
   - Fuente: `getHourlySales`.
   - Valor: `totalSales` por `hour`.
   - Valor de negocio: detecta horas pico para operación y staffing.

## Nota de integración con ngx-charts

Para todos los reportes anteriores, conviene normalizar cada respuesta del API a la forma base de `ngx-charts`:

- Serie simple: `{ name: string; value: number }[]`
- Serie múltiple: `{ name: string; series: Array<{ name: string; value: number }> }[]`

y reutilizar un `scheme` de colores derivado de variables CSS globales (`--brand-rose-strong`, `--brand-cocoa`, etc.).
