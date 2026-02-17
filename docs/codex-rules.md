# Reglas permanentes para CODEX (Monorepo)

Estas reglas aplican a cada requerimiento futuro dentro del monorepo.

## 1) Contratos y compatibilidad

- No romper contratos existentes de API/UI sin plan explícito.
- Si se requiere compatibilidad temporal:
  - agregar fallback en código,
  - cubrirlo con pruebas,
  - y documentarlo en `docs/compatibility-notes.md`.

## 2) Auditoría

Seguir `docs/auditing.md`:

- Usar convención de `Action` en PascalCase.
- Preferir patrón semántico consistente:
  - `CreateX`
  - `UpdateX`
  - `DeleteX`
  - (y variantes como `AssignX`, `RevokeX`, `SyncX`, `ImportX` cuando aplique).
- Mantener estructura de logging/auditoría consistente en módulos nuevos y existentes.

## 3) Reglas POS

Mantener las reglas de `docs/pos-sales.md`, incluyendo:

- `payment.reference` requerido para `Card` y `Transfer`.
- Idempotencia por `clientSaleId`.
- Cálculo de totales del lado servidor (source of truth).
- Persistencia de snapshots de catálogo/ítems según contrato vigente.

## 4) Pruebas obligatorias por tipo de cambio

- Cambios de contrato backend: Integration tests de API + actualización de docs.
- Cambios de validación/mapping frontend: Unit tests Vitest.
- Cambios de flujo crítico POS: E2E Playwright determinista de tipo UI-contract.

### Estilo de pruebas

- Backend (.NET): estructura **Arrange / Act / Assert**.
- Frontend unit: pruebas rápidas, enfocadas y estables.
- Playwright: determinista, usando selectores confiables (`data-testid`) y evitando flakiness.

## 5) CI y workflows

- No crear workflows dentro de `/backend` o `/frontend`.
- Todos los workflows CI/CD viven en `/.github/workflows`.
- Respetar pipeline vigente: pruebas de backend/frontend y deploy gated por CI exitoso.

## 6) Regla operativa por PR

Cada PR debe entregar en conjunto:

1. Código
2. Pruebas actualizadas/agregadas
3. Documentación actualizada

Si uno de los tres falta en cambios de contrato/reglas críticas, el PR se considera incompleto.
