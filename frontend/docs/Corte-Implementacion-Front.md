# Corte de Implementación Frontend POS

Fecha de corte: 2026-02-13

## Metodología
- Revisión estática de rutas, componentes, estilos, guards y servicios.
- Evidencia técnica por archivo/ruta/estado signal/form/service.
- Diagnóstico: `DONE`, `PARTIAL`, `TODO`, `BROKEN`.

## Matriz EPIC / FEATURE

| Epic / Feature | Front Estado | Evidencia (rutas/componentes/servicios/estado) | UX / Styling issues | Tests |
|---|---|---|---|---|
| A) Login / guard / layout base | **PARTIAL** | Rutas públicas `/login`, `/register`; protegida `/app` con `authGuard`; POS con `roleGuard(['Admin','Cashier'])`. Login con formularios signal + redirect por rol en `AuthService.resolvePostLoginUrl`. Layout en `AppShellComponent` con sidebar persistido por usuario y bandera `isFullWidthRoute`. | App shell centra contenido (`.app-main { justify-content:center; }`) y sólo libera ancho total si la ruta trae `data.fullWidth=true`; actualmente POS no declara ese `data`, por lo que el modo full-width queda sin activar en caja. | Sí: guard specs y auth specs existentes; sin e2e de navegación real por rol. |
| B) POS Caja (`PosCajaPage`) ancho/layout responsive | **PARTIAL** | Ruta `/app/pos/caja`; componente principal `PosCajaPage`. CSS de caja usa `width:100%` y `max-width:100%`, grid responsive (`.layout`, media queries 1100/700). | No hay límite explícito en `pos-caja`, pero el contenedor padre puede seguir centrando por layout shell; falta contrato de ruta full-width para garantizar uso total del ancho disponible en todas las resoluciones. | Sí: unit tests de lógica de caja; sin pruebas visuales responsive. |
| C1) Modal cierre: tamaño/scroll/espaciado | **PARTIAL** | Modal cierre en `pos-caja.page.html` (`.modal-card.modal-card--wide`, `.modal-body` con `overflow-y:auto`). CSS: `modal-card` `max-height:min(70vh,680px)` y `modal-body` scroll. | Riesgo de scroll interno frecuente por doble contenedor con alto limitado + padding; en pantallas bajas/móviles puede sentirse “apretado”. Requiere tuning de alturas/espacios. | Sin tests visuales de modal/scroll. |
| C2) Denominaciones grid/tamaños | **DONE** | Grid de denominaciones en `.denomination-grid` con `auto-fit minmax(150px,1fr)`, item compacto, input fijo. Breakpoint a 2 columnas en <=720px. | Puede saturarse con etiquetas largas o zoom alto; no hay reglas específicas de accesibilidad para tamaños táctiles mínimos. | Cobertura indirecta vía test de cálculo con denominaciones. |
| C3) Cálculo en vivo (contado/diferencia) | **DONE** | `countsValues` signal desde `FormArray.valueChanges`; `countedTotal = Σ denom*cant`; `closeDifference = expected - counted`; normalización de enteros >=0. Render reactivo en resumen de cierre. | Sin issue crítico funcional detectado. | Sí: `pos-caja.page.spec.ts` valida actualización en tiempo real. |
| C4) Motivo de diferencia solo si diferencia != 0 | **BROKEN** (contra requerimiento) | Regla de obligatoriedad sí existe (`requiresDifferenceReason` y validación en submit). Pero el textarea “Motivo de diferencia” siempre es visible; solo cambia placeholder/aria-required. | Incumple requerimiento UX: debe mostrarse únicamente cuando diferencia ≠ 0. | Sin test dedicado a visibilidad condicional. |
| D) Carrito / checkout | **PARTIAL** | `CartComponent` con qty +/-/remove y botón checkout. `PaymentModalComponent` calcula cambio en efectivo y bloquea confirmar si insuficiente. En `PosCajaPage.confirmPayment` se usa total calculado y `clientSaleId` reintento. | Vista de carrito no desglosa extras/selecciones en detalle de línea; posible confusión de precio final por item personalizado. | Sí: tests de monto enviado y reintento con mismo `clientSaleId`; sin e2e checkout completo. |
| E) Personalización (`CustomizationModalComponent`) + caso WAFFLE TRADICIONAL | **PARTIAL** | Habilitación de botón depende de `canConfirm()` que exige **todos** los grupos dentro de `[minSelections, maxSelections]`. `toggleSelection` respeta selección única (radio) y tope en múltiples. | Causa típica de “nunca habilita Agregar al carrito”: al menos un grupo requerido queda por debajo de `minSelections` (ej. grupo obligatorio sin selección posible o no atendido por usuario). Además no se aplican reglas por producto basadas en `overrides`/`includedItems` en este componente, por lo que puede haber inconsistencias entre lo esperado para WAFFLE TRADICIONAL y lo realmente validado. | Sin tests unitarios del modal de personalización ni del caso WAFFLE TRADICIONAL. |
| F) Integración API POS shifts + manejo de errores | **PARTIAL** | Servicio `PosShiftApiService` implementa endpoints `current/open/close-preview/close`. Parsea 204 de current a null. Manejo de errores combinado: interceptor global (status 0/500) + mensajes contextuales en `PosCajaPage` para open/close/sale. | Estrategia de errores dispersa (global + local) sin contrato unificado por códigos de dominio; puede haber mensajes duplicados o inconsistentes entre pantallas. | Sí: test de 204 current shift en servicio, tests de errores de venta en caja. |

---

## Diagnóstico específico solicitado

## A) Login / guard / layout
- **Regla de negocio (debería):** acceso a `/app/**` solo autenticado; autorización POS por rol; layout protegido adaptable (incluyendo ancho operativo para POS).
- **Regla actual (hoy):** autenticación/autorización están implementadas; redirección por rol funciona; modo full width depende de `data.fullWidth`, pero POS no lo está declarando.
- **Archivos responsables:**
  - Enable/disable acceso: `src/app/core/guards/auth.guard.ts`, `src/app/core/guards/role.guard.ts`, `src/app/app.routes.ts`, `src/app/features/app-shell/app-shell.routes.ts`.
  - Layout/ancho: `src/app/features/app-shell/app-shell.component.ts`.

## B) POS Caja ancho total + responsive
- **Regla de negocio:** usar ancho disponible completo para operación de caja y mantener experiencia responsive.
- **Regla actual:** CSS interno de caja sí está preparado para ancho completo, pero el shell puede no activar full width por metadata de ruta faltante.
- **Archivos responsables:**
  - Rutas: `src/app/features/pos/pos.routes.ts`.
  - Estilos caja: `src/app/features/pos/pages/pos-caja.page.css`.
  - Contenedor shell: `src/app/features/app-shell/app-shell.component.ts`.

## C) Modal “Cierre de turno”
- **Regla de negocio:** modal amplio, sin scroll innecesario, denominaciones legibles, cálculo en vivo, motivo visible solo con diferencia.
- **Regla actual:**
  - Tamaño/scroll: modal ancho pero con alto acotado y scroll interno permanente en `.modal-body`.
  - Denominaciones: grid funcional y compacto.
  - Cálculo: correcto en vivo (`contado` y `diferencia`).
  - Motivo: requerido cuando diferencia ≠ 0, pero **siempre visible** (gap UX).
- **Archivos responsables:**
  - Cálculo + validación enable/disable submit: `src/app/features/pos/pages/pos-caja.page.ts`.
  - Render condición motivo: `src/app/features/pos/pages/pos-caja.page.html`.
  - Estilos modal/denominaciones: `src/app/features/pos/pages/pos-caja.page.css`.

## D) Carrito / checkout
- **Regla de negocio:** editar carrito, abrir cobro, validar efectivo recibido, enviar pago con total calculado y evitar duplicados por reintento.
- **Regla actual:** implementado y funcional; bloqueo por turno abierto configurable; reintento usa mismo `clientSaleId`.
- **Archivos responsables:**
  - Enable/disable checkout: `src/app/features/pos/components/cart/cart.component.html`, `src/app/features/pos/pages/pos-caja.page.ts`.
  - Cálculo y validación en modal de pago: `src/app/features/pos/components/payment-modal/payment-modal.component.ts`.

## E) Personalización / WAFFLE TRADICIONAL
- **Regla de negocio:** botón “Agregar al carrito” habilita cuando cada grupo cumple min/max definido para el producto y sus reglas (untables/frutas/toppings/jarabes/extras).
- **Regla actual:**
  - `canConfirm()` aplica validación **global por todos los grupos**: `size >= minSelections && size <= maxSelections`.
  - Si **un solo grupo** queda fuera de rango (normalmente `< minSelections`), el botón permanece deshabilitado.
  - El componente no cruza reglas de `overrides`/`includedItems`; por ello, si WAFFLE TRADICIONAL requiere restricciones por producto, hoy no se aplican explícitamente en la UI de personalización.
- **Qué regla falla exactamente (con la evidencia disponible del front):**
  - Falla la condición de `canConfirm()` para algún grupo obligatorio con `minSelections > 0` que no alcanza mínimo.
  - Sin snapshot de datos concretos en repo para WAFFLE TRADICIONAL, no se puede afirmar cuál grupo específico (untables/frutas/toppings/jarabes/extras) sin inspeccionar payload real de catálogo en runtime.
- **Archivos responsables:**
  - Enable/disable botón: `src/app/features/pos/components/customization-modal/customization-modal.component.html` (`[disabled]="!canConfirm()"`) y `...component.ts` (`canConfirm`).
  - Reglas de selección: `.../customization-modal.component.ts` (`toggleSelection`, `canConfirm`).
  - Estilos de estado visual: `.../customization-modal.component.css`.

## F) Integración API shifts + errores
- **Regla de negocio:** consumir endpoints de turno y mostrar errores coherentes.
- **Regla actual:** endpoints implementados (`current/open/close-preview/close`), parse de 204 resuelto, manejo de errores repartido entre interceptor global y mensajes locales.
- **Archivos responsables:**
  - Endpoints: `src/app/features/pos/services/pos-shift-api.service.ts`.
  - Errores globales: `src/app/core/http/error.interceptor.ts`, `src/app/core/services/global-error.service.ts`.
  - Errores de caja/ventas: `src/app/features/pos/pages/pos-caja.page.ts`.

---

## Lista priorizada de tickets front (máx. 15)

1. **P1 – Activar full width real en POS Caja**
   - Pasos: agregar `data: { fullWidth: true }` en ruta `/app/pos/caja`; validar en desktop/móvil con sidebar abierto/cerrado.
   - Archivos: `src/app/features/pos/pos.routes.ts`, `src/app/features/app-shell/app-shell.component.ts` (si se requiere ajuste extra).

2. **P1 – Motivo de diferencia condicional visible**
   - Pasos: renderizar bloque de motivo sólo cuando `requiresDifferenceReason()` sea true; mantener `evidence` como opcional visible.
   - Archivos: `src/app/features/pos/pages/pos-caja.page.html`, `src/app/features/pos/pages/pos-caja.page.ts`.

3. **P1 – Optimizar UX modal cierre (sin scroll innecesario)**
   - Pasos: aumentar alto útil del modal en desktop, compactar paddings/espacios y evaluar quitar doble scroll (`modal-card` + `modal-body`).
   - Archivos: `src/app/features/pos/pages/pos-caja.page.css`.

4. **P1 – Diagnóstico visible por grupo en personalización**
   - Pasos: agregar mensaje de validación por grupo indicando “faltan X selecciones” o “excede máximo”.
   - Archivos: `src/app/features/pos/components/customization-modal/customization-modal.component.ts/html/css`.

5. **P1 – Soporte de reglas por producto (overrides) en modal**
   - Pasos: filtrar opciones permitidas por `productId + groupKey` usando `snapshot.overrides`.
   - Archivos: `src/app/features/pos/pages/pos-caja.page.ts`, `src/app/features/pos/components/customization-modal/customization-modal.component.ts`.

6. **P1 – Caso WAFFLE TRADICIONAL reproducible y testeado**
   - Pasos: crear fixture de snapshot con grupos untables/frutas/toppings/jarabes/extras; validar cuándo habilita botón.
   - Archivos: `src/app/features/pos/components/customization-modal/*.spec.ts` (nuevo), `src/app/features/pos/pages/pos-caja.page.spec.ts`.

7. **P2 – Mostrar detalle de extras/selecciones en carrito**
   - Pasos: renderizar sublíneas por item con extras y selecciones para evitar confusión de precio.
   - Archivos: `src/app/features/pos/components/cart/cart.component.html/css`.

8. **P2 – Unificar contrato de errores POS**
   - Pasos: mapear códigos backend a mensajes consistentes en helper/service; evitar dispersión de strings hardcodeados.
   - Archivos: `src/app/features/pos/pages/pos-caja.page.ts`, `src/app/core/http/error.interceptor.ts`.

9. **P2 – Pruebas unitarias de personalización**
   - Pasos: cubrir `toggleSelection`, límites max, min obligatorios y `canConfirm()`.
   - Archivos: `src/app/features/pos/components/customization-modal/customization-modal.component.spec.ts` (nuevo).

10. **P2 – Pruebas de visibilidad condicional de motivo**
    - Pasos: testear que aparece/desaparece según diferencia y que bloquea submit al faltar motivo.
    - Archivos: `src/app/features/pos/pages/pos-caja.page.spec.ts`.

11. **P2 – Pruebas de layout responsive de caja (visual/e2e)**
    - Pasos: escenarios 1366px/1024px/768px/390px con sidebar abierto/cerrado.
    - Archivos: setup e2e (carpeta de e2e), `src/app/features/pos/pages/pos-caja.page.css`.

12. **P3 – Accesibilidad modal cierre y personalización**
    - Pasos: foco inicial, trap de foco, escape coherente, labels y tamaños táctiles.
    - Archivos: `src/app/features/pos/pages/pos-caja.page.html/ts`, `src/app/features/pos/components/customization-modal/*`.

13. **P3 – Hardening de validación numérica denominaciones**
    - Pasos: mostrar mensaje inline por input inválido en vez de solo normalizar silenciosamente.
    - Archivos: `src/app/features/pos/pages/pos-caja.page.ts/html`.

14. **P3 – Observabilidad UX de errores**
    - Pasos: incluir códigos de error y correlación en logs funcionales no intrusivos.
    - Archivos: `src/app/features/pos/pages/pos-caja.page.ts`, `src/app/core/http/error.interceptor.ts`.

15. **P3 – Documentación funcional de reglas de personalización**
    - Pasos: documentar matriz de min/max por grupo y producto (incluye WAFFLE TRADICIONAL).
    - Archivos: `docs/PlanMaestro-Front.md`, docs de catálogo POS.
