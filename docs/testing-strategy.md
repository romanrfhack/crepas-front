# Testing Strategy (Monorepo)

Este documento define la estrategia de pruebas para backend/frontend y la regla permanente para cambios futuros.

## Pirámide de pruebas del repo

1. **Backend Integration API (.NET)**
   - Cubre contrato HTTP, validaciones, persistencia y reglas de negocio críticas en endpoints.
   - Debe validar payload de request/response y códigos de estado.

2. **Frontend Unit (Vitest)**
   - Cubre utilidades, mapping de datos, validaciones de formularios y comportamiento de componentes en aislamiento.
   - Debe ser rápido, determinista y enfocado en lógica.

3. **E2E Playwright (UI-contract)**
   - Cubre flujos críticos de usuario con impacto en negocio.
   - Para POS, validar contrato UI↔API interceptando rutas `/api/v1/pos/**` cuando aplique.

## Regla de oro

> **Todo cambio de contrato o regla crítica implica actualizar/agregar pruebas y documentación en el mismo PR.**

Esto aplica a backend, frontend y flujos POS.

## Cuándo agregar cada tipo de prueba

### 1) Cambios en request/response de endpoint
Agregar/actualizar:
- **Integration test** en backend para el endpoint afectado.
- **Documentación de contrato** (ejemplos y notas de compatibilidad).
  - Si hay fallback por compatibilidad, documentar en `docs/compatibility-notes.md`.

### 2) Cambios en validación o mapping de frontend
Agregar/actualizar:
- **Unit tests Vitest** del módulo/componente afectado.
- Casos nominales + casos de borde (valores faltantes, null/undefined, formatos inválidos).

### 3) Cambios en flujo crítico POS (venta/cobros/cierre/void)
Agregar/actualizar:
- **E2E Playwright “UI-contract”** para flujo completo.
- Interceptar y validar llamadas clave a `/api/v1/pos/**`.
- Asegurar aserciones de resultado visible en UI + contrato esperado.

## Definition of Done (DoD) por PR

Antes de mergear, todo PR debe cumplir:

- Build exitoso en áreas afectadas.
- Unit tests (frontend) pasando.
- E2E tests (frontend) pasando para flujos impactados.
- Integration/backend tests pasando.
- Documentación actualizada cuando haya:
  - Cambios de contrato.
  - Compatibilidad temporal/fallback.
  - Cambios en reglas críticas de negocio.

## Referencias

- `docs/compatibility-notes.md`
- `docs/auditing.md`
- `docs/pos-sales.md`
- `docs/Corte-Implementacion.md`
- `/.github/workflows/ci.yml`
