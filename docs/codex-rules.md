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

### E2E / Playwright UI-contract (estabilidad)

- No asertar por strings que incluyan datos de negocio variables (por ejemplo, nombres de productos como `"Café americano"`), salvo que el test controle ese dato en una constante única.
- Preferir aserciones por `data-testid` + estructura estable (contenedores dedicados para errores y CTAs).
- Si el mensaje incluye texto dinámico (`itemName`):
  1. Renderizar el error en un contenedor con `data-testid` estable (por ejemplo, `unavailable-banner`, `unavailable-toast`, `unavailable-modal`; usar el que ya exista en la UI).
  2. Asertar visibilidad del contenedor por `data-testid`.
  3. Asertar que el contenedor contiene el prefijo estático (`"No disponible"`) y, opcionalmente, `itemName` tomado del fixture/constante del test (no hardcodeado).
- Evitar regex dependientes del nombre exacto cuando ese dato no está controlado por el test.
- Si CODEX cambia fixtures E2E (nombres/ids), actualizar asserts para leer fixtures/constantes o mantener nombres estables.
- Si CODEX modifica copy/UI texts, preservar el contrato E2E con `data-testid` y prefijos estables.

Mini-ejemplo MAL vs BIEN:

- MAL: `expect(page.getByText("No disponible: Café americano")).toBeVisible()`
- BIEN: `expect(page.getByTestId("pos-unavailable")).toBeVisible()`
  `expect(page.getByTestId("pos-unavailable")).toContainText(/No disponible/i)`
  `expect(page.getByTestId("pos-unavailable")).toContainText(fixture.itemName)`

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

### Definition of Done / Checklist

- E2E: asserts estables por `data-testid`; no depender de nombres de producto/datos variables.
