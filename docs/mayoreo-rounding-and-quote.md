# Mayoreo: rounding + quote contract (hardening pre-Ventas)

## Qué se redondea y cuándo

Regla única de dinero:

- `roundMoney(x)` = redondeo a 2 decimales.
- Backend usa `decimal.Round(x, 2, MidpointRounding.AwayFromZero)`.
- Frontend usa `Math.round((x + Number.EPSILON) * 100) / 100`.

Aplicación:

1. **baseUnitPrice**: redondeado al calcular línea.
2. **appliedUnitPrice**: redondeado después de aplicar tier (porcentaje o precio fijo).
3. **lineSubtotal**: `roundMoney(appliedUnitPrice * qty)`.
4. **ticketTotal**: suma de subtotales de línea y redondeo final.

## Validación en backend (`/api/v1/pos/pricing/quote`)

Endpoint de cotización sin persistencia:

- Request:
  - `storeId`
  - `tenantPolicy` (opcional, para validar/recalcular exactamente el pricing de front en este hardening)
  - `lines[]` con `productId|externalCode`, `qty`, `basePrice?`, `requestedUnitPrice?`, `override?`
- Response:
  - `lines[]` con `baseUnitPrice`, `appliedUnitPrice`, `tierApplied`, `lineSubtotal`, `isMismatch`, `expectedUnitPrice`
  - `totals.subtotal/total`

`isMismatch=true` cuando `requestedUnitPrice` difiere del cálculo esperado del backend.

## Persistencia de snapshot en ventas

En `CreateSale` cada línea ahora acepta `pricingSnapshot` y se persiste:

- `SaleItem.UnitPriceSnapshot` guarda `appliedUnitPrice` aplicado.
- `SaleItem.NotesSnapshot` guarda JSON con:
  - `baseUnitPrice`
  - `appliedUnitPrice`
  - `wholesale` (`isApplied`, `minQty`, `discountType`, `discountValue`, `source`)
  - `pricingCalculatedAtUtc`

Así, auditoría y trazabilidad de pricing por línea quedan preservadas para Ventas.

## Pasos manuales para probar quote + mismatch

1. Abrir sesión POS con tenant/store activos.
2. Ejecutar `POST /api/v1/pos/pricing/quote` con:
   - línea con `qty` por debajo de `minQty` y `requestedUnitPrice=basePrice`.
   - validar `isMismatch=false` y `tierApplied=null`.
3. Ejecutar con `qty` arriba de `minQty` y `requestedUnitPrice` deliberadamente incorrecto.
   - validar `isMismatch=true` y `expectedUnitPrice` con valor recalculado.
4. En front, al abrir checkout se dispara revalidación:
   - si hay mismatch, línea de carrito se actualiza a `appliedUnitPrice` esperado.
