# Plan Maestro Frontend POS (v0.1)

> Estado base construido desde implementación actual del repo (sin documento roadmap previo).

## Alcance
Aplicación Angular POS con autenticación, shell protegido por roles, operación de caja, personalización de productos y checkout.

## Épicas y objetivo funcional

## EPIC 1. Acceso, seguridad y layout protegido
**Objetivo:** permitir login, proteger rutas y mostrar navegación según rol.

### Features
1. Login con validación y redirección por rol.
2. Guards de autenticación y autorización por rol.
3. App shell con menú lateral, estado persistente y vista full-width para páginas operativas.

### Criterios de aceptación
- Usuario no autenticado no puede entrar a `/app/**`.
- Usuario sin rol POS no accede a rutas POS.
- Rutas operativas POS deben poder renderizarse en ancho completo cuando se defina `data.fullWidth=true`.

---

## EPIC 2. POS Caja (flujo de venta)
**Objetivo:** operar caja en desktop/tablet/móvil usando el mayor ancho útil disponible.

### Features
1. Layout responsive con categorías, grid de productos y carrito.
2. Selección de productos con y sin personalización.
3. Carrito flotante, actualización de cantidades y checkout.
4. Integración de cobro con método (efectivo/tarjeta/transferencia).

### Criterios de aceptación
- Vista de caja sin límites innecesarios de ancho en contenedor padre.
- En móvil, layout de columna única y controles accesibles.
- Checkout bloqueado cuando la regla de turno abierto lo requiera.

---

## EPIC 3. Gestión de turnos de caja
**Objetivo:** abrir turno, consultar estado, previsualizar cierre y cerrar turno con denominaciones.

### Features
1. Apertura de turno con efectivo inicial y notas.
2. Consulta turno actual.
3. Cierre de turno con preview de esperado.
4. Conteo por denominación con cálculo en vivo.
5. Captura de motivo de diferencia sólo cuando aplique.

### Criterios de aceptación
- `contado = Σ(denominación * conteo)` en tiempo real.
- `diferencia = esperado - contado` en tiempo real.
- Motivo visible y obligatorio únicamente cuando diferencia ≠ 0.
- Modal de cierre sin scroll innecesario en pantallas comunes.

---

## EPIC 4. Personalización de productos
**Objetivo:** permitir seleccionar opciones por grupos con reglas min/max y extras.

### Features
1. Render dinámico de grupos por schema.
2. Validación de min/max por grupo para habilitar “Agregar al carrito”.
3. Manejo de selección única/múltiple.
4. Aplicación de reglas de overrides/included items por producto.

### Criterios de aceptación
- Botón “Agregar al carrito” habilitado cuando todos los grupos requeridos cumplen.
- Mensajería clara cuando un grupo invalida el formulario.
- Reglas por producto (ej. WAFFLE TRADICIONAL) respetadas y trazables.

---

## EPIC 5. Integración API y resiliencia
**Objetivo:** integrar endpoints POS críticos y homologar manejo de errores.

### Features
1. Servicios para `/v1/pos/shifts/current|open|close-preview|close`.
2. Servicio de ventas POS con correlación.
3. Manejo de errores HTTP global + contextual en pantallas POS.

### Criterios de aceptación
- Errores de red y 5xx muestran mensaje global consistente.
- Errores de negocio relevantes de caja muestran mensaje específico en la vista.
- Cobros reintentables sin duplicar venta (idempotencia por `clientSaleId`).

---

## Backlog maestro inicial (resumen)
1. Activar `data.fullWidth=true` en ruta `/app/pos/caja`.
2. Ajustar modal de cierre para evitar doble scroll y compactar spacing.
3. Mostrar “Motivo de diferencia” sólo si `diferencia !== 0`.
4. Instrumentar diagnóstico de validación de personalización por grupo.
5. Integrar en UI reglas de `overrides`/`includedItems` por producto.
6. Agregar pruebas unitarias de `CustomizationModalComponent`.
7. Consolidar manejo de errores API por dominio (turnos/ventas/auth).
