# Corte de implementación — Plan vs Backend actual

Fecha del corte: 2026-02-13

## 1) Hallazgo de Plan Maestro
No se encontró un plan maestro explícito (`PlanMaestro.md`, `ROADMAP.md`, backlog/TODO formal). Se creó `docs/PlanMaestro.md` v0.1 como baseline de planeación.

## 2) Inventario por EPIC / FEATURE

| Epic / Feature | Backend | Evidencia (rutas / handlers / entidades / migrations) | Tests | Notas / gaps |
|---|---|---|---|---|
| A1. Auth (register/login/refresh) | DONE | `AuthController` expone `/api/v1/auth/register`, `/login`, `/refresh`; uso de `IIdentityService` + `ITokenService`. | Cobertura indirecta en tests de integración que hacen login/register para operar Admin/POS. | No se ve suite dedicada a expiración/rotación/abuso de refresh token. |
| A2. Admin usuarios (list/get/roles/lock) | PARTIAL | `AdminUsersController` con `GET /admin/users`, `GET /admin/users/{id}`, `PUT /roles`, `POST /lock` y ruta compat `PUT /lock`; policy `AdminOnly`. | `AdminContractsTests` (paging y ruta compat lock), `PosCatalogIntegrationTests` (asignación de rol), `AuditLoggingTests` (lock auditable). | Faltan pruebas negativas explícitas 401/403 por endpoint y cobertura de edge-cases de validación. |
| A3. Admin roles | DONE | `AdminRolesController`: `GET/POST/DELETE /admin/roles`, con auditoría `CreateRole`/`DeleteRole`. | `AdminContractsTests.GetRoles_*`, `AuditLoggingTests.CreateRole_*`. | Sin test explícito de conflicto por rol existente (409). |
| B1. POS shifts current/open | DONE | `PosShiftsController` (`current`, `open`); `PosShiftService.OpenShiftAsync` resuelve alias `startingCashAmount`/`openingCashAmount` y persiste `OpenOperationId`. | `PosSalesIntegrationTests.OpenShift_WithStartingCashAmount_*`, `EnsureOpenShiftAsync` valida current/open. | Apertura idempotente devuelve turno existente; revisar semántica si payload difiere entre reintentos. |
| B2. POS shift close-preview | PARTIAL | `PosShiftService.GetClosePreviewAsync` calcula `salesCashTotal` y `expectedCashAmount`. | `PosSalesIntegrationTests.CloseShift_ComputesExpected...` valida preview básico. | Preview no devuelve `denominations`, ni `counted/difference` opcional; contrato no cubre todos los campos pedidos para cierre guiado. |
| B3. POS shift close persistencia arqueo | DONE | `CloseShiftAsync` persiste `ClosingCashAmount`, `ExpectedCashAmount`, `CashDifference`, `DenominationsJson`, `CloseNotes`, `CloseOperationId`; entidad `PosShift`; config + migración inicial incluyen columnas. | `PosSalesIntegrationTests.CloseShift_ComputesExpected...` valida DB (`ExpectedCashAmount`, `CashDifference`, `DenominationsJson`) y auditoría. | Falta endpoint/contrato para recuperar denominaciones históricas en `current` o `close-preview`. |
| C1. Registro de venta POS | DONE | `POST /api/v1/pos/sales`; `PosSalesService.CreateSaleAsync` crea `Sale`, `SaleItem`, `SaleItemSelection`, `SaleItemExtra`, `Payment`, auditoría. | `PosSalesIntegrationTests.CreateSale_PersistsSnapshot_And_Audit`. | Pago exige monto exacto al total; no hay soporte de pagos mixtos. |
| C2. Estado de venta (Completed/Cancelled) | PARTIAL | `SaleStatus` existe (`Completed`, `Void`) y reportes/cierre filtran `Completed`. | No hay test de transición a `Void` por API porque no existe endpoint de cancelación. | Gap funcional importante para operación real de caja (anulaciones/devoluciones). |
| C3. Relación venta-turno y expected de cierre | PARTIAL | `CreateSaleAsync` asigna `ShiftId` cuando hay turno abierto; `PosShiftService` calcula `Expected = Opening + CashSalesTotal`. | `CloseShift_ComputesExpected...` cubre fórmula y persistencia. | Selección de turno abierto usa `FirstOrDefault` sin orden explícito; riesgo si hay más de un turno abierto por inconsistencia de datos. |
| D1. Compatibilidad SQLite / SQL Server | PARTIAL | Ramas `IsSqlite()` en `PosShiftService` y `PosSalesService` para consultas críticas; DI soporta ambos proveedores. | Tests API corren sobre SQLite in-memory (`SmokeTests` factory), + tests de aplicación con SQLite. | Sin evidencia de ejecución automatizada equivalente sobre SQL Server real (riesgo de divergencias LINQ/SQL). |
| E1. Auditoría + correlación | DONE | `AuditLogger` serializa before/after camelCase; `CorrelationIdMiddleware` inyecta/propaga `X-Correlation-Id`; controladores POS/Admin escriben eventos. | `AuditLoggerTests` + `AdminAuditIntegrationTests` + tests POS verifican audit rows. | Cobertura parcial por endpoint; recomendable política uniforme de eventos de negocio críticos. |
| F1. Migraciones y drift | PARTIAL | Existe una sola migración `20260212230944_Initial` + snapshot, con tablas POS/Auth/Audit. | Sin test/check de drift automático. | Riesgo de drift en ambientes largos si se tocan entidades sin nueva migración. |

---

## 3) Revisión específica solicitada: **Cierre de turno**

### Confirmación funcional actual (backend)
- `close-preview` devuelve: `shiftId`, `openedAtUtc`, `openingCashAmount`, `salesCashTotal`, `expectedCashAmount`.
- `close` persiste correctamente en `PosShift`:
  - `ExpectedCashAmount`
  - `DenominationsJson`
  - `CashDifference`
  - `CloseNotes`
  - además `ClosingCashAmount` y `CloseOperationId`.

### Gap respecto al objetivo solicitado
- El preview **no devuelve denominaciones actuales** ni acepta conteo para devolver `counted/difference` pre-cierre.
- No hay campo explícito de `motivo` separado de `CloseNotes` (podría mapearse, pero no está estandarizado).

### Mapeo test → feature (cierre de turno)
- `PosSalesIntegrationTests.CloseShift_ComputesExpectedCountedAndDifference_FromCashDenominations`
  - valida fórmula de expected con venta cash,
  - valida preview básico,
  - valida persistencia `ExpectedCashAmount`, `CashDifference`, `DenominationsJson`,
  - valida auditoría de cierre.
- `PosSalesIntegrationTests.OpenShift_WithStartingCashAmount_PersistsResponseDbAndAudit`
  - valida mapeo `startingCashAmount` en apertura y rastro de auditoría.

---

## 4) Endpoints clave: contrato, regla, ubicación, faltantes E2E

## A) Auth & usuarios/roles/admin

### `POST /api/v1/auth/register`
- Request: `RegisterRequest` (email/password).
- Response: `AuthResponse` (tokens).
- Regla: crea usuario, luego emite tokens.
- Dónde: `AuthController.Register`.
- Falta E2E: casos de contraseña débil / email duplicado con aserciones de contrato detalladas.

### `POST /api/v1/auth/login`
- Request: `LoginRequest`.
- Response: `AuthResponse`.
- Regla: valida credenciales y emite tokens.
- Dónde: `AuthController.Login`.
- Falta E2E: cobertura de lockout y escenarios de credenciales inválidas con payload de error estable.

### `POST /api/v1/auth/refresh`
- Request: `RefreshTokenRequest`.
- Response: `AuthResponse`.
- Regla: rota/renueva token si refresh válido.
- Dónde: `AuthController.Refresh`.
- Falta E2E: expiración/reuso de refresh y revocación.

### `GET/PUT/POST /api/v1/admin/users...` y `GET/POST/DELETE /api/v1/admin/roles`
- Request/Response: DTOs admin (`AdminUserDto`, `AdminRoleDto`, etc.).
- Regla: sólo `AdminOnly`, cambios auditables con correlación.
- Dónde: `AdminUsersController`, `AdminRolesController`.
- Falta E2E: matriz completa 401/403 por rol y pruebas de conflicto/validación de negocio.

## B) POS Turnos

### `GET /api/v1/pos/shifts/current`
- Response: `PosShiftDto` o `204 NoContent`.
- Regla: obtener turno abierto más reciente.
- Dónde: `PosShiftsController.GetCurrent` → `PosShiftService.GetCurrentShiftAsync`.
- Falta E2E: incluir denominaciones/expected cuando aplica (si se decide enriquecer contrato).

### `POST /api/v1/pos/shifts/open`
- Request: `OpenPosShiftRequestDto` (`openingCashAmount`/`startingCashAmount`, `notes`, `clientOperationId`).
- Response: `PosShiftDto`.
- Regla: mapea alias de efectivo inicial; evita duplicidad por operación y por turno ya abierto.
- Dónde: `PosShiftService.OpenShiftAsync`.
- Falta E2E: caso de operación idempotente con payload distinto y comportamiento esperado documentado.

### `GET /api/v1/pos/shifts/close-preview`
- Response: `ShiftClosePreviewDto`.
- Regla: calcula `expected = opening + cashSalesCompleted`.
- Dónde: `PosShiftService.GetClosePreviewAsync`.
- Falta E2E: preview con denominaciones previas y cálculo opcional de diferencia con conteo enviado.

### `POST /api/v1/pos/shifts/close`
- Request: `ClosePosShiftRequestDto` (`countedDenominations[]`, `closingNotes`, `clientOperationId`).
- Response: `ClosePosShiftResultDto`.
- Regla: valida denominaciones, calcula counted/expected/difference, persiste cierre y audita.
- Dónde: `PosShiftService.CloseShiftAsync`.
- Falta E2E: validación de motivo obligatorio cuando diferencia excede umbral (si negocio lo requiere).

## C) Ventas POS

### `POST /api/v1/pos/sales`
- Request: `CreateSaleRequestDto` (items + selections + extras + payment).
- Response: `CreateSaleResponseDto`.
- Regla: valida catálogo activo, arma snapshots, exige payment exacto, asocia `ShiftId` si turno abierto (según opción), audita.
- Dónde: `PosSalesService.CreateSaleAsync`.
- Falta E2E: anulaciones/cancelaciones (estado `Void`) y recalculo de métricas de turno/reportes.

## D) Reportes POS

### `GET /api/v1/pos/reports/daily-summary`
- Response: `DailySummaryDto`.
- Regla: agrega tickets/items/monto promedio sobre ventas `Completed`.
- Dónde: `PosSalesService.GetDailySummaryAsync`.
- Falta E2E: timezone de negocio y precisión en cierres de día locales.

### `GET /api/v1/pos/reports/top-products`
- Response: `TopProductDto[]`.
- Regla: ranking por rango de fecha y ventas `Completed`.
- Dónde: `PosSalesService.GetTopProductsAsync`.
- Falta E2E: verificación de empates y orden estable.

---

## 5) Migraciones y esquema (drift)
- Migración presente: `20260212230944_Initial`.
- Incluye tablas/columnas críticas para este corte: `PosShifts` (incluye `ExpectedCashAmount`, `CashDifference`, `DenominationsJson`, `CloseNotes`, operation IDs), `Sales` (incluye `ShiftId`, `Status`), `Payments`, `AuditLogs`, Identity.
- Diagnóstico: **sin drift evidente en lectura estática** (entidades/configuración concuerdan con la migración inicial), pero **sin check automatizado** contra DB real por ambiente.

---

## 6) Próximos tickets priorizados (máx. 15)

1. **POS-001 Enriquecer close-preview con arqueo opcional**  
   - Descripción: extender preview para aceptar conteo opcional y devolver `countedCashAmount`, `difference`, y últimas denominaciones conocidas.  
   - Archivos probables: `PosShiftDtos.cs`, `PosShiftsController.cs`, `PosShiftService.cs`, tests de integración POS.  
   - Tests: contrato preview + casos con/sin conteo.

2. **POS-002 Endpoint de anulación/cancelación de venta**  
   - Descripción: agregar `POST /pos/sales/{id}/void` o similar, actualizar estado y auditoría.  
   - Archivos: `PosSalesController.cs`, `PosSalesService.cs`, DTOs, entidad/config si se requieren metadatos de cancelación.  
   - Tests: transición `Completed->Void`, impacto en reportes/cierre.

3. **POS-003 Robustecer selección de turno abierto para ventas**  
   - Descripción: ordenar explícitamente por `OpenedAtUtc` y manejar inconsistencia de múltiples turnos abiertos.  
   - Archivos: `PosSalesService.cs`, posiblemente constraint/regla adicional.  
   - Tests: múltiples turnos abiertos simulados.

4. **POS-004 Política de motivo obligatorio por diferencia**  
   - Descripción: si `abs(difference)` supera umbral, exigir `closingNotes`/motivo.  
   - Archivos: `PosShiftService.cs`, options/config.  
   - Tests: validación 400 y caso OK con motivo.

5. **SEC-001 Matriz de autorización por endpoint crítico**  
   - Descripción: tests negativos 401/403 para AdminOnly/PosOperator/PosAdmin.  
   - Archivos: `*.Tests` integración API.  
   - Tests: usuarios sin rol, rol incorrecto, token ausente.

6. **SEC-002 Hardening refresh token lifecycle**  
   - Descripción: cobertura de expiración/reuso/revocación de refresh token.  
   - Archivos: servicios de identidad/token + tests API.  
   - Tests: refresh inválido, refresh reutilizado, refresh expirado.

7. **DB-001 Pipeline dual-provider (SQLite + SQL Server)**  
   - Descripción: ejecutar suite crítica en ambos proveedores.  
   - Archivos: CI workflows + factory de tests.  
   - Tests: smoke + POS sales/shifts + admin audit.

8. **DB-002 Check automático de drift EF Core**  
   - Descripción: job que falle si snapshot/modelo divergen sin migración.  
   - Archivos: scripts CI, docs backend.  
   - Tests: validación de generación de migración vacía.

9. **AUD-001 Cobertura de auditoría para eventos faltantes**  
   - Descripción: asegurar que endpoints críticos escriban auditoría consistente.  
   - Archivos: controladores/servicios POS+Admin.  
   - Tests: assert de AuditLogs por acción.

10. **POS-005 Exponer denominaciones de último cierre en consulta de turno**  
    - Descripción: enriquecer DTO de turno actual/histórico para UX de caja.  
    - Archivos: DTOs shifts, servicio shifts.  
    - Tests: serialización y persistencia de `DenominationsJson`.

11. **POS-006 Contrato explícito de estado de venta (Completed/Void) en API**  
    - Descripción: publicar DTOs/endpoint para listar detalle de venta con status.  
    - Archivos: controller/service de ventas, contratos.  
    - Tests: contratos JSON y filtros por estado.

12. **POS-007 Reconciliación de reportes con cierre de turno**  
    - Descripción: endpoint de resumen de turno cerrado con desglose efectivo/tarjeta/transferencia.  
    - Archivos: servicios POS/reportes, DTOs.  
    - Tests: dataset mixto de pagos.

13. **POS-008 Reglas de carrito/personalizaciones (validaciones de negocio avanzadas)**  
    - Descripción: validar mínimos/máximos por grupo de selección y consistencia de overrides.  
    - Archivos: validators POS catalog/sales, servicios.  
    - Tests: casos límite de combinaciones inválidas.

14. **OPS-001 Métricas y logging estructurado de cierres de caja**  
    - Descripción: publicar métricas técnicas/negocio (duración turno, diferencia promedio).  
    - Archivos: observability middleware/services.  
    - Tests: smoke de emisión de métricas/log keys.

15. **DOC-001 Especificación OpenAPI de ejemplos POS críticos**  
    - Descripción: ejemplos request/response para open/preview/close/sale/void.  
    - Archivos: anotaciones controllers/docs.  
    - Tests: validación de swagger generado en CI.
