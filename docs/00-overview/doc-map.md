# doc-map.md — Jerarquía documental de CobranzaDigital

## Objetivo

Definir qué documentos son fuente de verdad y cómo deben interpretarlos:
- OpenClaw
- revisores técnicos
- prompts operativos
- futuros documentos del monorepo

Este mapa existe para evitar mezclar:
- contrato vigente
- estado actual
- roadmap
- auditorías/diagnósticos
- runbooks operativos

---

## Niveles de autoridad documental

### Nivel 1 — Normativo / fuente de verdad

Estos documentos mandan sobre snapshots, auditorías y propuestas históricas.

Ubicación recomendada:
- `docs/10-governance/*`
- `docs/20-contracts/*`

Incluye, entre otros:
- `docs/10-governance/agent-rules.md`
- `docs/10-governance/compatibility-notes.md`
- `docs/10-governance/auditing.md`
- `docs/10-governance/multi-tenant-and-authz.md`
- `docs/10-governance/error-responses.md`
- `docs/20-contracts/pos-sales-contract.md`
- `docs/20-contracts/pos-catalog-contract.md`
- `docs/20-contracts/pos-reports-contract.md`
- `docs/20-contracts/inventory-contract.md`
- `docs/20-contracts/platform-contracts.md`
- `docs/20-contracts/admin-users-roles-contract.md`

Uso:
- contratos HTTP / UI
- compatibilidades temporales
- reglas de negocio vigentes
- reglas de autorización / scoping
- expectativas permanentes para OpenClaw

Regla:
- Si un documento de Nivel 1 contradice una auditoría o un corte de implementación, gana el Nivel 1.

---

### Nivel 2 — Calidad y operación

Documentos vivos de ejecución, pruebas, pipeline y estándares técnicos.

Ubicación recomendada:
- `docs/40-quality/*`
- `docs/50-runbooks/*`

Incluye, entre otros:
- `docs/40-quality/testing-strategy.md`
- `docs/40-quality/testing-matrix.md`
- `docs/40-quality/ci-cd.md`
- `docs/40-quality/frontend-standards.md`
- `docs/50-runbooks/backend-testing-runbook.md`
- `docs/50-runbooks/local-dev.md`
- `docs/50-runbooks/deployment.md`

Uso:
- saber qué pruebas actualizar según el cambio
- saber cómo correr backend/frontend localmente
- saber cómo funciona CI/CD
- saber qué estándares técnicos deben respetarse

Regla:
- Nivel 2 no redefine contratos.
- Nivel 2 ejecuta y valida lo definido en Nivel 1.

---

### Nivel 3 — Estado actual y roadmap

Documentos que describen cómo está hoy el sistema y hacia dónde se quiere llevar.

Ubicación recomendada:
- `docs/30-state/*`

Incluye, entre otros:
- `docs/30-state/current-state-backend.md`
- `docs/30-state/current-state-frontend.md`
- `docs/30-state/roadmap-product.md`

Uso:
- entender qué ya existe
- detectar gaps
- priorizar trabajo
- alinear expectativas del siguiente cambio

Regla:
- Nivel 3 no reemplaza contrato.
- Si el estado actual contradice el contrato, se reporta como gap o deuda.

---

### Nivel 4 — Auditorías / diagnósticos / histórico

Evidencia útil, pero no normativa por sí sola.

Ubicación recomendada:
- `docs/90-audits/*`

Incluye, entre otros:
- auditorías técnicas por funcionalidad
- cortes de implementación
- reportes de estandarización
- diagnósticos de bugs
- evaluaciones temporales del repo

Ejemplos:
- `docs/90-audits/roles-audit-2026-02-26.md`
- `docs/90-audits/sqlserver-standardization-report.md`
- `docs/90-audits/inventory-v2-audit.md`
- `docs/90-audits/snapshot-404-diagnosis.md`
- `docs/90-audits/catalog-excel-audit.md`
- `docs/90-audits/warnings-cleanup.md`
- `docs/90-audits/current-state-backend-legacy.md`
- `docs/90-audits/current-state-frontend-legacy.md`

Uso:
- rescatar hallazgos
- entender decisiones previas
- revisar regresiones
- reutilizar ideas de diseño o pruebas

Regla:
- Las auditorías no mandan sobre contratos vigentes.
- Si una auditoría contiene endpoints, DTOs o recomendaciones, deben validarse contra Nivel 1 antes de tratarse como vigentes.

---

## Regla de resolución de conflictos

Cuando dos documentos parezcan contradecirse, aplicar este orden:

1. Nivel 1 — Normativo / contratos / compatibilidad
2. Nivel 2 — Calidad / operación / pruebas / CI
3. Nivel 3 — Estado actual / roadmap
4. Nivel 4 — Auditorías / diagnósticos / histórico

Si persiste la duda:
- no asumir
- reportar el conflicto
- pedir validación humana

---

## Regla de interpretación para OpenClaw

Antes de proponer un cambio, OpenClaw debe:

1. Leer documentos de Nivel 1 del área afectada.
2. Revisar `testing-matrix.md` para identificar pruebas impactadas.
3. Consultar Nivel 3 solo para entender contexto y gaps.
4. Usar Nivel 4 únicamente como antecedente o evidencia.
5. Si encuentra conflicto entre contrato y auditoría, reportarlo antes de cambiar código.

---

## Clasificación recomendada de documentos actuales

### Deben vivir como Nivel 1
- `compatibility-notes.md`
- `auditing.md`
- `ErrorResponses.md`
- contratos POS y platform vigentes
- documentos consolidados de multi-tenant/authz

### Deben vivir como Nivel 2
- `testing-strategy.md`
- `testing-matrix.md`
- `ci-cd.md`
- guía backend testing
- estándares frontend Angular/TS

### Deben vivir como Nivel 3
- `PlanMaestro.md` consolidado en `roadmap-product.md`
- `PlanMaestro-Front.md` absorbido en `roadmap-product.md`
- `Corte-Implementacion.md` consolidado como estado actual backend
- `Corte-Implementacion-Front.md` consolidado como estado actual frontend

### Deben vivir como Nivel 4
- auditorías puntuales por funcionalidad
- reportes de estandarización
- diagnósticos históricos
- notas de limpieza o hardening no normativas

---

## Regla editorial para nuevos documentos

Al crear un documento nuevo, debe indicar explícitamente cuál de estas categorías es:

- `NORMATIVE`
- `QUALITY`
- `STATE`
- `AUDIT`

Formato sugerido al inicio:

```md
Status: NORMATIVE
Authority: Level 1
Scope: backend | frontend | monorepo
Last updated: YYYY-MM-DD
Owner: <persona o equipo>