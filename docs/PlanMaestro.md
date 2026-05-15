# Plan Maestro histórico (v0.1) — CobranzaDigital Backend (.NET)

> Estado: **derivado del código actual** (no existía un Plan Maestro formal en el repo al momento del corte).
> Este documento queda como histórico. Para release operativo vigente usar
> `docs/release-config.md` y `docs/50-runbooks/deployment.md`.

## Objetivo de producto
Consolidar un backend POS de caja para operación diaria con:
- autenticación/roles,
- catálogo configurable (productos, opciones, extras),
- venta en caja con personalizaciones,
- turnos de caja (apertura/cierre + arqueo),
- reportes operativos,
- auditoría y trazabilidad.

## EPICs y metas de cierre

## EPIC A — Auth, usuarios y roles admin
**Meta:** gestionar acceso por JWT y administración de usuarios/roles con auditoría.

### Alcance esperado
- `auth/register`, `auth/login`, `auth/refresh`.
- ABM básico de roles (`admin/roles`) y gestión de roles/bloqueo por usuario (`admin/users`).
- Policies consistentes para Admin, POS Admin, POS Operator.
- Tests de contratos + permisos por rol.

### Estado inferido
**PARTIAL**: endpoints y políticas existen, faltan pruebas explícitas de matriz de autorización completa y hardening de flujos (p.ej. coverage negativa por rol).

## EPIC B — POS turnos de caja
**Meta:** controlar turno vigente y cierre con arqueo completo.

### Alcance esperado
- `GET /api/v1/pos/shifts/current`
- `POST /api/v1/pos/shifts/open`
- `GET /api/v1/pos/shifts/close-preview`
- `POST /api/v1/pos/shifts/close`
- Compatibilidad `openingCashAmount` / `startingCashAmount`.
- Persistencia de `DenominationsJson`, `ExpectedCashAmount`, `ClosingCashAmount`, `CashDifference`, notas/motivo.

### Estado inferido
**PARTIAL alto**: núcleo implementado y probado; gap en contrato de `close-preview` (no devuelve denominaciones ni variante con conteo enviado).

## EPIC C — Ventas POS y relación con turnos
**Meta:** registrar ventas con personalizaciones/pagos y asociarlas a turno abierto.

### Alcance esperado
- Alta de venta con ítems + selecciones + extras + pago.
- Estado de venta (completada/cancelada/void) con reglas y auditoría.
- Asociación robusta con `ShiftId`.
- Cálculo de efectivo esperado de cierre: `openingCashAmount + cashSalesTotal`.

### Estado inferido
**PARTIAL**: creación de venta y asociación a turno funcionan; no hay endpoint explícito de cancelación/void y la lógica de elección de turno abierto puede fortalecerse.

## EPIC D — SQL Server como proveedor release

### Alcance esperado
- Consultas críticas funcionando contra SQL Server real.
- Tests de integración API y validación de migraciones contra SQL Server.

### Estado inferido
**DONE para Ruta A**: runtime, CI y tests de integración API usan SQL Server. SQLite no forma parte
del contrato de release contenido.

## EPIC E — Auditoría, logging y correlación
**Meta:** trazabilidad de operaciones administrativas y POS.

### Alcance esperado
- Persistir `AuditLog`/`AuditEntry` con before/after JSON.
- Correlation ID propagado por middleware.
- Pruebas de persistencia y forma del payload.

### Estado inferido
**DONE (base)**: infraestructura y pruebas presentes para casos clave; faltaría cobertura ampliada en todos los endpoints críticos.

## EPIC F — Migraciones y drift de esquema
**Meta:** esquema estable y verificable.

### Alcance esperado
- Migraciones versionadas por cambios de modelo.
- Check de drift (modelo vs snapshot vs DB real).

### Estado inferido
**DONE para Ruta A**: CI ejecuta `--migrate-only` contra SQL Server sin
`SUPPRESS_EF_PENDING_MODEL_CHANGES_WARNING`. Fase 7 cerró el drift de snapshot con la migración
no-op `20260514153113_F7PendingModelDrift`.

## Priorización macro sugerida
1. Cerrar flujo de **cierre de turno E2E** (close-preview enriquecido + pruebas de contrato).
2. Completar **estado de venta/cancelación** y su efecto en reportes/cierre.
3. Fortalecer **autorización por rol** y pruebas negativas por endpoint.
4. Mantener **validación de migración/drift** SQL Server en CI sin suppressions.
5. Consolidar tickets de UX/API para carrito/personalizaciones y reportes operativos.
