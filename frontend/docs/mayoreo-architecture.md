# Implementación MVP de Mayoreo (Fase 0 + arquitectura elegida)

## Mapa actual de pricing en el repo

- **POS calcula precios en frontend** en `PosCajaPage` usando `cartItems` + `estimatedTotal`.
- La línea de ticket (`CartItem`) incluye `productId`, `quantity`, `basePrice`, `extras`, y ahora `appliedUnitPrice` + `wholesaleTierLabel`.
- El subtotal mostrado en carrito proviene de `item.appliedUnitPrice * item.quantity` (más extras en total estimado).
- Existen descuentos implícitos por disponibilidad/overrides de catálogo, pero no un motor de precio por cantidad previo.
- Persistencia de venta (`createSale`) actualmente envía `productId/quantity/selections/extras/payments`; **no persiste precio calculado del frontend**, lo calcula backend al registrar la venta.

## Decisión de arquitectura para mayoreo (MVP)

Se eligió **motor de pricing en frontend** con reglas obtenidas desde backend:

1. `WholesalePricingService` (determinístico, puro) aplica:
   - política tenant,
   - override de producto,
   - selección de tier por mayor `minQty <= qty`.
2. `PosWholesaleApiService` obtiene:
   - política tenant (`/v1/pos/wholesale/policy`),
   - override por producto (`/v1/pos/wholesale/products/{productId}/override`).
3. `PosCajaPage` recalcula automáticamente al subir/bajar cantidad.
4. UI muestra indicador: **“Mayoreo aplicado · ≥X ...”**.

### Justificación

- El repo actual es solo frontend Angular, sin capa backend/.NET dentro de este workspace.
- El flujo de POS ya centraliza cálculo visual en frontend, por lo que la integración más cohesiva MVP es local + endpoints de configuración.
- Se deja la ruta preparada para migrar motor al backend sin romper UI (servicio dedicado + contrato DTO).
