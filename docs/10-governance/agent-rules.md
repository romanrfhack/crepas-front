
## 2) `docs/10-governance/agent-rules.md`

```md
# agent-rules.md — Reglas permanentes para OpenClaw y revisiones técnicas

Status: NORMATIVE
Authority: Level 1
Scope: monorepo
Last updated: 2026-03-10
Owner: Román / arquitectura técnica

## Objetivo

Definir cómo debe trabajar OpenClaw dentro de CobranzaDigital y qué reglas son obligatorias antes de:
- proponer cambios
- ejecutar comandos
- escribir archivos
- validar pruebas
- recomendar PRs

---

## 1. Regla general de lectura previa

Antes de tocar código, OpenClaw debe leer:

1. documentos normativos del área afectada
2. `docs/40-quality/testing-matrix.md`
3. `docs/10-governance/compatibility-notes.md` si hay cambios de:
   - contrato
   - alias
   - fallback
   - transición temporal
4. documentos de estado/roadmap solo para contexto
5. auditorías solo como evidencia histórica

OpenClaw no debe tratar auditorías o cortes como fuente de verdad si existe un documento normativo más reciente o consolidado.

---

## 2. Cambio mínimo y seguro

OpenClaw debe:
- proponer el cambio mínimo necesario
- evitar refactors cosméticos mezclados con cambios funcionales sensibles
- evitar “arreglar de paso” otras áreas no pedidas
- reportar archivos afectados antes de escribir
- listar riesgos técnicos y contractuales

OpenClaw no debe:
- romper contratos por conveniencia técnica
- eliminar compatibilidad temporal sin permiso explícito
- convertir una auditoría en contrato sin validación humana

---

## 3. Contratos y compatibilidad

Reglas obligatorias:

- No romper contratos existentes de API/UI sin plan explícito.
- Si se requiere compatibilidad temporal:
  - agregar fallback en código,
  - cubrirlo con pruebas,
  - documentarlo en `docs/10-governance/compatibility-notes.md`.
- Todo cambio de contrato o regla crítica implica actualizar pruebas y documentación en el mismo PR.
- Si un cambio agrega campos opcionales o alias temporales, deben ser aditivos y backward-compatible salvo instrucción explícita en sentido contrario.

Compatibilidad y contratos tienen prioridad sobre propuestas de auditorías pasadas.

---

## 4. Pruebas obligatorias por tipo de cambio

### 4.1 Cambios en contrato backend
Requieren:
- integration tests de API backend
- actualización de documentación de contrato
- actualización de `compatibility-notes.md` si existe fallback o transición

### 4.2 Cambios en validación, mapping o formularios frontend
Requieren:
- unit tests Vitest
- casos nominales + casos de borde
- actualización de documentación si cambia shape, reglas o compatibilidad

### 4.3 Cambios en flujo crítico POS
Requieren:
- E2E Playwright determinista tipo UI-contract
- intercept de `/api/v1/pos/**` cuando aplique
- validación visible en UI + validación de contrato

### 4.4 Cambios en inventario, ventas POS, cierres, reportes o multi-tenant
Requieren:
- pruebas backend y/o frontend según `testing-matrix.md`
- revisión de tenant/store scoping
- revisión de compatibilidad
- revisión de auditoría si la acción genera eventos críticos

### 4.5 Definition of Done mínima
Un cambio no está completo si falta cualquiera de estos cuando aplica:
- código
- pruebas
- documentación

---

## 5. Reglas backend obligatorias

OpenClaw debe respetar:

- `ProblemDetails` / estructura de errores documentada
- reglas multi-tenant y tenant/store scoping
- contratos POS vigentes de:
  - ventas
  - catálogo
  - inventario
  - reportes
- reglas de auditoría para acciones críticas
- runbook backend/testing vigente
- entorno SQL Server como estándar actual del backend

No debe:
- reintroducir dependencias o supuestos SQLite
- romper precedencia de tenant/store
- asumir que un endpoint descrito en una auditoría sigue vigente sin validar documentos normativos

---

## 6. Reglas frontend obligatorias

OpenClaw debe respetar el estándar técnico del frontend:

- TypeScript estricto
- evitar `any`
- componentes standalone por default
- `signals`, `computed()`, `OnPush`
- `input()` / `output()`
- `inject()`
- Reactive Forms
- control flow nativo (`@if`, `@for`, `@switch`)
- evitar `ngClass`, `ngStyle`, `@HostBinding`, `@HostListener`
- accesibilidad AA / AXE

Además:
- no debe diagnosticar automáticamente un 404 de deep link `/app/...` como bug del router si puede ser ausencia de SPA fallback en hosting
- debe respetar los contratos UI-contract basados en `data-testid`
- en Playwright debe evitar asserts frágiles basados en texto variable de negocio

---

## 7. Reglas de auditoría

OpenClaw debe seguir `docs/10-governance/auditing.md`.

Como regla general:
- usar convenciones semánticas consistentes de `Action`
- mantener `EntityType`, `EntityId`, `CorrelationId` y demás campos del contrato de auditoría
- si agrega una nueva acción auditada, debe:
  - mantener convención
  - agregar/update tests
  - actualizar documentación

No debe:
- cambiar naming de acciones sin razón fuerte
- introducir eventos auditados inconsistentes entre módulos

---

## 8. Reglas multi-tenant y autorización

OpenClaw debe tratar auth/scoping como tema de alto riesgo.

Antes de tocar estas áreas debe revisar:
- `docs/10-governance/multi-tenant-and-authz.md`
- contratos platform/admin POS afectados
- `compatibility-notes.md`

Debe asumir como sensibles:
- roles
- policies
- claims JWT
- `tenantId`
- `storeId`
- `X-Tenant-Id`
- rutas protegidas
- scoping de `/admin/users`
- comportamiento de `SuperAdmin`, `TenantAdmin`, `AdminStore`, `Manager`, `Cashier`

Si detecta contradicción entre código actual y auditorías previas de roles/scoping, debe reportarla y no “resolverla” silenciosamente.

---

## 9. Reglas POS

OpenClaw debe tratar POS como dominio crítico.

En especial no debe romper sin validación explícita:
- `payment.reference` para `Card` y `Transfer`
- idempotencia por `clientSaleId`
- cálculo de totales del lado servidor
- snapshot/catálogo según contrato vigente
- reglas de disponibilidad
- reglas de inventario y reasons estables
- flujos de turno, preview y cierre
- reportes POS y sus filtros/DTOs

Si el cambio toca POS:
- revisar `testing-matrix.md`
- revisar contrato correspondiente
- revisar `compatibility-notes.md`
- revisar si hay implicaciones de auditoría

---

## 10. Cómo tratar auditorías y cortes

Las auditorías y cortes:
- sirven para entender hallazgos previos
- sirven para detectar gaps
- sirven para rescatar ideas o riesgos

Pero NO deben usarse como contrato vigente si:
- hay documento normativo consolidado
- hay hoja de contrato más reciente
- hay nota de compatibilidad posterior

Si una auditoría propone endpoints, DTOs o arquitectura futura, OpenClaw debe tratarlos como propuesta, no como implementación confirmada.

---

## 11. Cuándo debe pedir ASK_HUMAN

OpenClaw debe pedir validación humana antes de continuar cuando detecte:

- cambio de contrato API
- cambio de compatibilidad o fallback
- cambio de auth, roles, scoping tenant/store o claims
- cambio de reglas de inventario, ventas POS, turnos o reportes
- cambio de layout global, shell o rutas protegidas
- migraciones o cambios destructivos
- acciones que impliquen:
  - escribir archivos
  - crear ramas
  - instalar dependencias
  - correr comandos no triviales
  - commits
  - push
  - PR

---

## 12. Modo operativo por defecto

Por defecto OpenClaw debe:

1. leer
2. analizar
3. proponer
4. listar archivos impactados
5. listar pruebas requeridas
6. listar docs a actualizar
7. pedir autorización antes de ejecutar o escribir

No debe asumir permiso de escritura por contexto histórico.
Cada tarea debe validar explícitamente el alcance autorizado.

---

## 13. Regla de salida esperada por tarea

Antes de ejecutar cambios, OpenClaw debe responder con algo equivalente a:

- área impactada: backend / frontend / full-stack
- contratos afectados
- compatibilidad afectada
- riesgos
- archivos previstos
- pruebas requeridas
- documentación que debe actualizarse
- si requiere ASK_HUMAN

Si no puede determinar eso con suficiente confianza, debe detenerse y pedir revisión humana.