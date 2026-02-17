# Testing Matrix (Feature/Endpoint → Tests → Qué actualizar)

Base inicial derivada de `docs/Corte-Implementacion.md` para estandarizar mantenimiento de pruebas.

| Feature / Endpoint | Tests existentes (base) | Si se modifica, qué actualizar |
|---|---|---|
| `POST /api/v1/pos/sales` (crear venta) | Integration backend de creación, reglas de pago/idempotencia y cálculo server-side (según corte). | Integration tests de contrato (request/response), reglas de `payment.reference`, idempotencia `clientSaleId`; Vitest si cambia mapping UI; E2E UI-contract POS si cambia flujo de venta/cobro. |
| `GET /api/v1/pos/reports/daily-summary` | Integration backend para agregado diario (según corte). | Integration tests de filtros y shape de respuesta; E2E si afecta pantalla operativa/reportes visibles. |
| `GET /api/v1/pos/reports/top-products` | Cobertura en servicio con verificación principal; pendiente robustecer empates/orden estable (según corte). | Integration/backend tests para orden estable y empates; actualizar docs de reporte si cambia contrato. |
| Flujo de turnos POS (open / preview / close) | Cobertura parcial descrita en corte para reglas de caja/cierre. | Integration backend para reglas de cierre y diferencias; E2E Playwright para flujo crítico de caja si cambia UX o contrato UI↔API. |
| Auditoría de acciones críticas (Admin/POS) | Convención y campos documentados en `docs/auditing.md`; cobertura parcial por módulo. | Tests backend que verifiquen `Action`, `EntityType`, `EntityId`, `CorrelationId`; actualizar docs si se agregan nuevas acciones/convenciones. |
| Contratos Admin (users/roles/lock) | Compatibilidades documentadas en `docs/compatibility-notes.md`. | Integration tests de compat (`page`/`pageNumber`, `POST`/`PUT` lock, DTO roles); actualizar compatibility notes si cambia fallback. |
| Frontend mapping/validaciones de formularios críticos | Suite Vitest del frontend (según CI vigente). | Agregar/actualizar unit tests Vitest por cada cambio de mapping, validación o normalización de payload. |
| Flujos críticos UI POS (venta/cobros/cierre/void) | E2E Playwright en CI (cuando aplica frontend). | Agregar/actualizar E2E deterministas con `data-testid` e intercept de `/api/v1/pos/**` para validar contrato y resultado en UI. |

## Uso recomendado en PR

1. Identifica la fila del feature/endpoint impactado.
2. Actualiza tests de la columna “qué actualizar”.
3. Si el cambio introduce un nuevo feature/endpoint, agrega una nueva fila a esta matriz.
4. Vincula también cambios de contrato en `docs/compatibility-notes.md` cuando aplique.
