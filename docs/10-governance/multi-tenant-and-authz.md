# multi-tenant-and-authz.md — Scoping multi-tenant, roles y autorización

Status: NORMATIVE
Authority: Level 1
Scope: monorepo
Last updated: 2026-03-10
Owner: Román / arquitectura técnica

## Objetivo

Definir el modelo vigente de:
- multi-tenant
- tenant/store scoping
- roles
- policies
- autorización backend
- comportamiento esperado de frontend cuando hay contexto platform/tenant/store

Este documento manda sobre auditorías históricas o snapshots puntuales.
Si una auditoría contradice este documento, se reporta el conflicto y no se asume cambio automático.

---

## 1. Definiciones

- **Vertical**: industria o giro del tenant.
- **Tenant**: organización cliente dentro de la plataforma.
- **Store**: sucursal operativa de un tenant.

Regla base:
- Todo dato operativo POS pertenece a un tenant.
- Cuando aplica operación por sucursal, también pertenece a una store válida de ese tenant. :contentReference[oaicite:3]{index=3}

---

## 2. Resolución de tenant

### 2.1 Usuarios tenant normales

Para usuarios no `SuperAdmin`, el backend resuelve tenant principalmente desde:
- claim JWT `tenantId`
- fallback a `AspNetUsers.TenantId` cuando el claim no existe

Esto existe por compatibilidad con usuarios legacy durante la transición multi-tenant. :contentReference[oaicite:4]{index=4} :contentReference[oaicite:5]{index=5}

### 2.2 SuperAdmin

`SuperAdmin` puede operar en dos modos:

- **modo platform global**  
  `EffectiveTenantId = null`

- **modo tenant explícito**
  enviando:
  - header `X-Tenant-Id: <guid>`
  - o, en algunos casos documentados, `tenantId` por query

Regla:
- `SuperAdmin` puede trabajar cross-tenant solo donde el contrato lo permite.
- Para endpoints operativos tenant-scoped, `SuperAdmin` debe seleccionar tenant efectivo cuando el endpoint así lo requiera. :contentReference[oaicite:6]{index=6} :contentReference[oaicite:7]{index=7}

---

## 3. Tenant context efectivo

El contexto expuesto por backend debe distinguir entre:

- `TenantId`: tenant propio del usuario
- `EffectiveTenantId`: tenant efectivo del request
- `IsPlatformAdmin`: verdadero cuando el actor es `SuperAdmin`

Regla:
- usuarios tenant no pueden overridear a otro tenant
- si un no-superadmin envía `X-Tenant-Id` distinto a su tenant, la respuesta esperada es `403` :contentReference[oaicite:8]{index=8} :contentReference[oaicite:9]{index=9}

---

## 4. Resolución de store

La store operativa no debe asumirse por frontend como fuente de verdad de autorización.

Reglas vigentes:
- la store del request debe pertenecer al tenant efectivo
- si `storeId` corresponde a otro tenant, backend debe responder `404` o `403` según el flujo/endpoint
- el frontend puede mantener contexto local para UX, pero la autorización crítica debe validarse server-side :contentReference[oaicite:10]{index=10} :contentReference[oaicite:11]{index=11}

### 4.1 Claims de store

Regla normativa objetivo:
- JWT mantiene `tenantId` cuando corresponde
- JWT agrega `storeId` cuando el usuario tiene sucursal asignada

Sin embargo, si el código real todavía tiene zonas legacy donde `storeId` no está garantizado, eso debe tratarse como gap de implementación, no como cambio de contrato silencioso. :contentReference[oaicite:12]{index=12} :contentReference[oaicite:13]{index=13}

---

## 5. Reglas de scoping por dominio

### 5.1 POS operativo

Endpoints POS operativos requieren tenant y validan pertenencia de `storeId` al tenant actual.

Ejemplos típicos:
- `/api/v1/pos/sales`
- `/api/v1/pos/shifts`
- `/api/v1/pos/admin/*`
- `GET /api/v1/pos/catalog/snapshot` cuando no puede resolverse store de forma segura

Regla:
- no mezclar datos entre tenants
- `Sale`, `PosShift` y `Store` deben persistir `TenantId` para aislamiento
- si el `storeId` es de otro tenant, la respuesta no debe exponer datos ajenos :contentReference[oaicite:14]{index=14}

### 5.2 POS reportes

Algunos reportes POS permiten modo platform global para `SuperAdmin`; otros requieren tenant efectivo.

Casos expresamente documentados como permitidos cross-tenant global para `SuperAdmin`:
- `GET /api/v1/pos/reports/kpis/summary`
- `GET /api/v1/pos/reports/sales/daily`
- `GET /api/v1/pos/reports/payments/methods`
- `GET /api/v1/pos/reports/control/cash-differences`

Regla:
- no asumir que todos los `/pos/reports/*` aceptan modo global
- si un endpoint fuerza tenant efectivo, debe respetarse ese guard/scoping :contentReference[oaicite:15]{index=15} :contentReference[oaicite:16]{index=16}

### 5.3 Platform

Los endpoints `/api/v1/platform/*`:
- usan policy `PlatformOnly`
- son exclusivos de `SuperAdmin`
- operan cross-tenant según su contrato
- no deben depender de `X-Tenant-Id` salvo que el contrato del endpoint lo requiera explícitamente

Ejemplo claro:
- `GET /api/v1/platform/dashboard/*` es cross-tenant global y no requiere `X-Tenant-Id` :contentReference[oaicite:17]{index=17}

---

## 6. Matriz normativa de override para SuperAdmin

### 6.1 SuperAdmin sin `X-Tenant-Id`

Permitido:
- `/api/v1/platform/*`
- reportes POS globales expresamente soportados por contrato

No permitido:
- endpoints operativos tenant-scoped que requieren tenant efectivo

Respuesta esperada cuando el endpoint operativo exige tenant:
- `400 tenantId required for this endpoint in platform mode` :contentReference[oaicite:18]{index=18} :contentReference[oaicite:19]{index=19}

### 6.2 SuperAdmin con `X-Tenant-Id`

Permitido:
- operar como tenant efectivo en endpoints POS tenant-scoped
- mantener acceso a endpoints platform cuando el contrato lo admita

Regla:
- el override debe afectar scoping, no reescribir ownership de datos persistidos de forma incorrecta :contentReference[oaicite:20]{index=20}

---

## 7. Modelo vigente de roles

Modelo final vigente:

- `SuperAdmin`
- `TenantAdmin`
- `AdminStore`
- `Manager`
- `Cashier`

Regla de compatibilidad:
- la transición `Admin` → `AdminStore` ya está cerrada
- policies, guards, claims y scoping deben operar con el modelo final
- no debe reintroducirse dependencia funcional en el rol legacy `Admin` salvo migración explícita documentada :contentReference[oaicite:21]{index=21}

### 7.1 Descripción normativa por rol

#### SuperAdmin
- acceso a `/api/v1/platform/*`
- acceso POS multi-tenant controlado
- puede usar `X-Tenant-Id`
- puede trabajar en modo global o tenant específico
- alcance global sobre usuarios/tenants/stores conforme al contrato vigente :contentReference[oaicite:22]{index=22}

#### TenantAdmin
- administración completa dentro de su tenant
- sin capacidades plataforma global
- puede operar POS admin/reportes/operación dentro de su tenant :contentReference[oaicite:23]{index=23}

#### AdminStore
- administración operativa por sucursal/tienda dentro del tenant
- alcance restringido a su store y tenant asociado
- es el nombre final del antiguo `Admin` de sucursal :contentReference[oaicite:24]{index=24} :contentReference[oaicite:25]{index=25}

#### Manager
- operación y supervisión dentro del tenant/store permitido
- acceso según policies POS y scoping aplicable
- sin acceso plataforma global
- sin acceso a `/api/v1/admin/users` salvo que un contrato normativo futuro lo cambie explícitamente :contentReference[oaicite:26]{index=26}

#### Cashier
- operación POS básica
- sin acceso a plataforma
- sin acceso a admin users
- el enforcing crítico sigue siendo server-side por tenant/store :contentReference[oaicite:27]{index=27}

---

## 8. Policies backend vigentes

Policies normativas a respetar:

- `PlatformOnly` → `SuperAdmin`
- `TenantScoped` → requiere claim `tenantId`
- `TenantOrPlatform` → claim `tenantId` o rol `SuperAdmin`

Además, por grupo funcional:
- `/api/v1/platform/*` → `PlatformOnly`
- `/api/v1/pos/admin/*` → `TenantOrPlatform` + policy POS admin correspondiente
- `/api/v1/pos/reports/*` → `TenantOrPlatform` + `PosReportViewer`
- endpoints operativos POS pueden requerir tenant efectivo adicional vía guard de operación/scoping :contentReference[oaicite:28]{index=28} :contentReference[oaicite:29]{index=29}

---

## 9. Admin Users — reglas normativas de scope

### 9.1 Objetivo de alcance

`/api/v1/admin/users*` debe seguir scoping por actor.

Modelo normativo:
- `SuperAdmin` → vista global + filtros por tenant/store
- `TenantAdmin` → usuarios de su tenant
- `AdminStore` → usuarios del contexto permitido de su store/tenant
- `Manager` y `Cashier` → sin acceso salvo contrato futuro explícito

Esto se alinea con la evolución contractual documentada para create/edit/reset password y con la transición cerrada hacia `AdminStore`. :contentReference[oaicite:30]{index=30} :contentReference[oaicite:31]{index=31}

### 9.2 Reglas por actor en operaciones críticas de usuarios

#### Crear usuario
- `SuperAdmin`: puede crear dentro de cualquier tenant/store válido
- `TenantAdmin`: solo dentro de su tenant
- `AdminStore`: solo `Manager`/`Cashier` en su propia store
- `Manager`/`Cashier`: `403` :contentReference[oaicite:32]{index=32}

#### Reset temporal de contraseña
- `SuperAdmin`: puede resetear targets válidos en cualquier scope permitido
- `TenantAdmin`: solo dentro de su tenant
- `AdminStore`: solo `Manager`/`Cashier` de su store
- no se resetean `SuperAdmin` por este endpoint
- nunca se audita ni se loguea el valor del password temporal :contentReference[oaicite:33]{index=33} :contentReference[oaicite:34]{index=34}

#### Editar usuario
- `SuperAdmin`: cualquier tenant/store válido
- `TenantAdmin`: solo dentro de su tenant
- `AdminStore`: solo dentro de su store/tenant
- `Manager`/`Cashier`: `403`
- si un rol requiere `storeId`, debe validarse que la store pertenezca al tenant indicado :contentReference[oaicite:35]{index=35}

---

## 10. Asignación tenant/store por rol

Reglas normativas:

- `TenantAdmin`:
  - `tenantId` requerido
  - `storeId` opcional

- `AdminStore`, `Manager`, `Cashier`:
  - `tenantId` requerido
  - `storeId` requerido
  - backend valida que `storeId` pertenezca a `tenantId`

- si existe `StoreId`, debe existir coherencia con el `TenantId` del usuario :contentReference[oaicite:36]{index=36} :contentReference[oaicite:37]{index=37}

---

## 11. Frontend — reglas normativas de contexto

### 11.1 Platform tenant context

En frontend, `SuperAdmin` puede seleccionar tenant activo para operar superficies tenant-scoped.

Reglas:
- el contexto platform seleccionado debe propagarse mediante `X-Tenant-Id` solo en requests POS/reportes/snapshot donde aplique
- no debe añadirse a `/platform/*`
- si el tenant seleccionado deja de ser válido, frontend debe limpiar el contexto para evitar requests inválidos :contentReference[oaicite:38]{index=38} :contentReference[oaicite:39]{index=39}

### 11.2 Scoped navigation

Las superficies platform pueden navegar a users/dashboard/inventory pasando `tenantId` y/o `storeId` por query params como contexto UX.

Regla:
- esos query params ayudan a prefill, navegación y foco operativo
- no sustituyen la autorización server-side
- no agregan permisos nuevos por sí mismos :contentReference[oaicite:40]{index=40} :contentReference[oaicite:41]{index=41}

### 11.3 Rutas protegidas

Reglas generales de frontend:
- `/app/platform/**` → solo `SuperAdmin`
- `/app/admin/users` y `/app/admin/roles` → sujetas al contrato vigente de admin users/roles
- `/app/admin/pos/**` e inventario → roles permitidos por contrato POS admin
- `/app/pos/**` → roles operativos según contrato/guards vigentes

Si frontend y backend divergen, debe considerarse bug de alineación y no debe “resolverse” sin revisar contrato. :contentReference[oaicite:42]{index=42}

---

## 12. Pruebas obligatorias cuando cambia auth/scoping

Si un cambio toca:
- roles
- policies
- `tenantId`
- `storeId`
- `X-Tenant-Id`
- guards
- navegación contextual
- `/api/v1/admin/users*`
- `/api/v1/platform/*`
- endpoints POS tenant-scoped

entonces deben revisarse y actualizarse las pruebas correspondientes en `testing-matrix.md`.

Coberturas mínimas esperadas:
- tenant isolation
- `SuperAdmin` global vs tenant-scoped
- `X-Tenant-Id`
- `403` para override inválido
- `400 tenantId required...` en modo platform sin tenant
- visibilidad de UI por rol y filtros tenant/store cuando aplique :contentReference[oaicite:43]{index=43} :contentReference[oaicite:44]{index=44}

---

## 13. Compatibilidades cerradas y reglas de transición

### 13.1 Tenant claim legacy
- usuarios legacy sin claim `tenantId` siguen resolviendo tenant por lookup
- esto existe por compatibilidad y no debe removerse sin plan explícito de migración/documentación/pruebas :contentReference[oaicite:45]{index=45}

### 13.2 `Admin` → `AdminStore`
- transición cerrada
- contratos nuevos deben usar `AdminStore`
- no crear nueva dependencia funcional en `Admin` legacy :contentReference[oaicite:46]{index=46}

---

## 14. Qué no debe hacer OpenClaw

OpenClaw no debe:

- asumir que una auditoría histórica describe el comportamiento vigente
- permitir override de tenant a usuarios no `SuperAdmin`
- confiar en contexto local frontend como autorización suficiente
- reintroducir rol `Admin` como eje normativo si el contrato final ya usa `AdminStore`
- ampliar acceso de `Manager` o `Cashier` a superficies admin/users/platform sin instrucción y pruebas explícitas
- cambiar tenant/store scoping sin actualizar tests y documentación

---

## 15. Cuándo pedir ASK_HUMAN

OpenClaw debe pedir validación humana si el cambio afecta:
- emisión de claims JWT
- policies o guardas de autorización
- `X-Tenant-Id`
- contratos `/api/v1/admin/users*`
- contratos `/api/v1/platform/*`
- scoping tenant/store de POS
- rutas protegidas frontend
- transición de roles o nombres de rol
- cualquier cambio que altere el alcance efectivo de un actor