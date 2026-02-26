# Auditoría de roles, autorización y scoping (backend + frontend)

Fecha: 2026-02-26
Alcance: `/backend`, `/frontend`, `/docs`.

## A) Resumen ejecutivo

- Los roles activos detectados en código son: `SuperAdmin`, `TenantAdmin`, `Admin`, `Manager`, `Cashier`, `User`, `Collector`. Todos están en seeding/gestión de identidad, pero **no todos** participan en políticas de autorización activas.  
- En backend, las políticas efectivas para acceso funcional usan principalmente `Admin`, `Manager`, `TenantAdmin`, `Cashier`, `SuperAdmin`; `User` y `Collector` quedan prácticamente fuera de rutas protegidas de negocio.  
- El endpoint `GET /api/v1/admin/users` está protegido por `AdminOnly`, que hoy equivale estrictamente a rol `Admin`; **no** permite `SuperAdmin`, `TenantAdmin`, ni `Manager`. Además, lista usuarios globales sin filtro por tenant/store.  
- El modelo `ApplicationUser` incluye `TenantId` pero no `StoreId`; el JWT emite claim `tenantId` (cuando existe) y **no** emite `storeId`. El contexto de store en frontend se toma de `localStorage` y/o claims opcionales no garantizados.  
- Hay diferencias relevantes entre frontend y backend: frontend habilita navegación POS para `Manager`, pero rutas hijas POS (`caja`, `reportes`) no mantienen esa simetría (por ejemplo, `Manager` no entra a `caja`). También hay divergencia entre docs y código en permisos de reportes POS.

## B) Inventario de roles y policies

### 1. Roles encontrados

| Rol | Definición | Uso principal observado |
|---|---|---|
| `Admin` | Seeding de roles por defecto y políticas (`AdminOnly`, `PosAdmin`, `PosOperator`, `PosReportViewer`). | Admin de usuarios/roles (`/admin/*`), POS admin, POS operación, reportes POS. |
| `Manager` | Seeding + políticas `PosAdmin`, `PosOperator`, `PosReportViewer`. | POS admin/operación/reportes (sin `/admin/users`). |
| `TenantAdmin` | Seeding + políticas `PosAdmin`, `PosOperator`, `PosReportViewer`. | POS admin/operación/reportes por tenant (sin `/admin/users`). |
| `Cashier` | Seeding + política `PosOperator`. | Operación POS (ventas/turnos/catálogo snapshot), sin reportes/admin POS/plataforma. |
| `SuperAdmin` | Seeding + políticas `PlatformOnly`, `PosAdmin`, `PosOperator`, `PosReportViewer`, `TenantOrPlatform`. | `/platform/*` y POS multi-tenant con `X-Tenant-Id`; en modo platform sin tenant, endpoints operativos POS fallan por guard. |
| `User` | Seeding y rol por defecto en registro (`auth/register`). | Sin políticas de negocio útiles por defecto. |
| `Collector` | Seeding únicamente. | Sin políticas/rutas activas detectadas. |

### 2. Policies backend

- `AdminOnly`: requiere rol `Admin` (solo ese rol).  
- `PosAdmin`: `Admin`, `Manager`, `TenantAdmin`, `SuperAdmin`.  
- `PosOperator`: `Admin`, `Cashier`, `Manager`, `TenantAdmin`, `SuperAdmin`.  
- `PosReportViewer`: `Admin`, `Manager`, `TenantAdmin`, `SuperAdmin`.  
- `PlatformOnly`: `SuperAdmin`.  
- `TenantScoped`: requiere claim `tenantId`.  
- `TenantOrPlatform`: claim `tenantId` o rol `SuperAdmin`.

### 3. Endpoints clave por grupo

- `/api/v1/admin/users*` y `/api/v1/admin/roles*`: `AdminOnly` (solo `Admin`).
- `/api/v1/platform/*`: `PlatformOnly` (solo `SuperAdmin`).
- `/api/v1/pos/admin/*`: `TenantOrPlatform` + `PosAdmin`; para operaciones, `SuperAdmin` sin tenant efectivo recibe `400 tenantId required...` por `PosTenantGuard` (en los endpoints que usan validación tenant-scoped en servicios/controladores).
- `/api/v1/pos/reports/*`: `TenantOrPlatform` + `PosReportViewer`; subset de endpoints permite modo platform global para `SuperAdmin` (`kpis/summary`, `sales/daily`, `payments/methods`, `control/cash-differences`), mientras otros fuerzan tenant efectivo por `ExecuteTenantScopedAsync`.

### 4. Guards/rutas frontend

- `roleGuard` permite acceso si el usuario autenticado tiene cualquiera de los roles declarados en `data.roles`/guard.  
- Rutas:
  - `/app/platform/**`: solo `SuperAdmin`.
  - `/app/admin/users`, `/app/admin/roles`: solo `Admin`.
  - `/app/admin/pos/**` e inventario: `Admin`, `Manager`, `TenantAdmin`, `SuperAdmin`.
  - `/app/pos` (shell): `Admin`, `Cashier`, `Manager`; hijos:
    - `/app/pos/caja`: `Admin`, `Cashier`.
    - `/app/pos/reportes`: `Admin`, `Manager`.
- Interceptor `platform-tenant.interceptor`: solo para `SuperAdmin`, añade `X-Tenant-Id` a requests POS admin/reportes/snapshot cuando hay tenant-context seleccionado; excluye `/platform/*`.

### 5. Diferencias “esperado vs real” (autorización)

- Docs indican en partes que reportes POS son `Admin`/`Manager`, pero código backend permite también `TenantAdmin` y `SuperAdmin` vía `PosReportViewer`.  
- `SuperAdmin` tiene menú “Admin” en navegación para POS catálogo/inventario, pero no para `users/roles` (correcto por data.roles).  
- `GET /admin/users` no está tenant-scoped ni store-scoped y solo admite `Admin`, aunque la estrategia multi-tenant del resto del dominio sí existe para POS.

## C) Auditoría de user scoping actual

### 1. Modelo de usuario

- `ApplicationUser` tiene `TenantId: Guid?`.  
- `ApplicationUser` no tiene `StoreId` ni equivalente persistido para asignación de sucursal por usuario.

### 2. Claims JWT actuales

- Siempre: `sub`, `email`, `nameidentifier`, `jti`, roles (`ClaimTypes.Role`).  
- Condicional: `scope = cobranza.read` solo si el usuario tiene rol `Admin`.  
- Condicional: `tenantId` si `ApplicationUser.TenantId` tiene valor.  
- No existe claim `storeId` emitido por backend.

### 3. Resolución tenant/store efectiva hoy

- Tenant:
  - `ITenantContext` resuelve `TenantId`/`EffectiveTenantId` desde claim `tenantId` y/o fallback a `AspNetUsers.TenantId`.
  - `SuperAdmin` puede usar override por header `X-Tenant-Id` o query `tenantId`; no-superadmin no puede overridear otro tenant (403).
- Store:
  - Backend POS resuelve store operativo vía `PosStoreContextService` (config POS + `requestedStoreId`) validando pertenencia al tenant efectivo.
  - Frontend POS usa `StoreContextService` con `localStorage` (`pos_active_store_id`) y fallback opcional a claims no garantizados (`storeId`, `store_id`, etc.), pero backend no emite esos claims hoy.

### 4. Estado de asociación usuario->store

- No hay vínculo estructural usuario-store en `ApplicationUser`; el scoping principal de seguridad es por tenant + validación de pertenencia de store al tenant en servicios POS.

## D) Auditoría específica de administración de usuarios

### Flujo actual real

- **Listar usuarios**: `GET /api/v1/admin/users` (con `page`/`pageNumber`, `pageSize`, `search`).
- **Crear usuarios**: no hay endpoint admin dedicado; hoy se crea por `POST /api/v1/auth/register` (asigna rol `User` y tenant por defecto).
- **Editar roles**: `PUT /api/v1/admin/users/{id}/roles`.
- **Bloquear/desbloquear**: `POST /api/v1/admin/users/{id}/lock` y compat `PUT /.../lock`.
- **Gestionar catálogo de roles**: `GET/POST/DELETE /api/v1/admin/roles`.

### Endpoint solicitado: `GET /admin/users?pageNumber=1&pageSize=10`

- Quién puede verlo hoy: solo rol `Admin` (`AdminOnly`).
- Filtro por tenant/store: **no**; el query usa `_userManager.Users` global y pagina/search sin `TenantId`.
- ¿SuperAdmin ve todos? No por policy actual (403 en ausencia de `Admin`).
- ¿Admin/TenantAdmin/Manager ven todos o filtrado?
  - `Admin`: ve todos (global).
  - `TenantAdmin`: no puede acceder.
  - `Manager`: no puede acceder.
- Frontend de usuarios soporta scoping tenant/store: no; consume `/v1/admin/users` con paginación/búsqueda únicamente.

## E) Hallazgos y huecos

| Rol | Alcance esperado hoy (según código) | Alcance real hoy | Problemas detectados | Riesgo |
|---|---|---|---|---|
| `SuperAdmin` | Plataforma + POS admin/operator/report viewer (con tenant override). | Correcto en backend; en POS operativo exige tenant efectivo; en reports hay subset global. | Puede quedar fuera de `/admin/users` por `AdminOnly`; potencial inconsistencia con “admin global”. | Medio |
| `TenantAdmin` | POS admin/operator/report dentro tenant. | Backend lo permite por policies POS; frontend también en `/app/admin/pos/*`. | No administra usuarios hoy; docs/expectativas pueden asumir lo contrario. | Medio |
| `Admin` | Admin usuarios/roles + POS completo (tenant). | Ve y modifica usuarios globalmente sin tenant filter. | Riesgo alto multi-tenant por ausencia de filtro en `/admin/users*`. | Alto |
| `Manager` | POS admin/operator/report en tenant. | Backend incluye operación (incl. ventas/turnos) por `PosOperator`; frontend no deja entrar a `/app/pos/caja` (solo Admin/Cashier). | Divergencia frontend-backend; experiencia y control operativo ambiguo. | Medio |
| `Cashier` | Operación POS básica. | Backend y frontend le dan caja POS; reportes/admin restringidos. | Sin claim storeId persistente; depende de store activo local + validación server-side por tenant/store. | Bajo-Medio |
| `User` | Rol base de registro. | Sin capacidades relevantes en módulos auditados. | Puede generar cuentas “huérfanas” funcionalmente sin onboarding de rol adecuado. | Bajo |
| `Collector` | Sin políticas activas detectadas. | Sin uso real visible en módulos auditados. | Rol muerto/huérfano aumenta complejidad y riesgo de configuración errónea futura. | Bajo |

## Recomendación técnica objetivo (sin implementar)

### Modelo de roles propuesto

- `SuperAdmin`: gobierno de plataforma y operaciones cross-tenant controladas.
- `TenantAdmin`: administración del tenant (incluyendo usuarios del tenant) sin capacidades plataforma global.
- `AdminStore` (renombre de `Admin`): administración operativa por sucursal/tienda dentro tenant.
- `Manager`: operación y supervisión (reportes, voids, cierre/apertura según política).
- `Cashier`: operación de caja acotada.

### Decisiones recomendadas

1. **¿TenantAdmin debería administrar usuarios?**
   - Sí, del propio tenant. Es el punto natural para gobierno descentralizado en SaaS multi-tenant.
   - Debe tener restricciones para no escalar a `SuperAdmin` ni tocar tenants ajenos.

2. **¿Hace falta `StoreId` en `ApplicationUser`?**
   - Recomendado, al menos como `DefaultStoreId` opcional o tabla relacional `UserStores` para multi-store por usuario.
   - Permite enforcing server-side consistente sin depender de estado local frontend.

3. **¿Hace falta claim `storeId`?**
   - Recomendado incluir claim derivado (`defaultStoreId`) para UX inicial, pero la autorización crítica debe seguir validándose server-side contra relación persistida usuario-store.

4. **Comportamiento deseado de `admin/users`**
   - `SuperAdmin`: vista global y filtro por tenant.
   - `TenantAdmin`: solo usuarios de su tenant.
   - `AdminStore`: usuarios del tenant y opcionalmente solo stores asignadas según modelo.
   - `Manager`/`Cashier`: sin acceso (o solo lectura limitada según negocio).

### Cambios mínimos vs estructurales

- **Cambios mínimos**
  - Ajustar policy de `admin/users` para incluir roles requeridos y aplicar filtro por `TenantId` en servicio.
  - Homologar frontend rutas/nav con backend (ej. `Manager` en caja si realmente aplica; o restringir backend).
  - Alinear docs con políticas reales (`PosReportViewer` incluye `TenantAdmin`/`SuperAdmin`).

- **Cambios estructurales**
  - Incorporar modelo de pertenencia usuario-store (`DefaultStoreId` y/o `UserStores`).
  - Incluir claims de contexto (tenant/store) consistentes y versionar contrato auth.
  - Refactor de autorizaciones hacia policies por capacidad (no solo role strings), con pruebas negativas/positivas por endpoint crítico.

## Archivos clave revisados

### Backend
- `backend/src/CobranzaDigital.Api/Program.cs`
- `backend/src/CobranzaDigital.Api/AuthorizationPolicies.cs`
- `backend/src/CobranzaDigital.Api/Controllers/Admin/AdminUsersController.cs`
- `backend/src/CobranzaDigital.Api/Controllers/Admin/AdminRolesController.cs`
- `backend/src/CobranzaDigital.Api/Controllers/Platform/PlatformControllers.cs`
- `backend/src/CobranzaDigital.Api/Controllers/Pos/PosAdminCatalogController.cs`
- `backend/src/CobranzaDigital.Api/Controllers/Pos/PosReportsController.cs`
- `backend/src/CobranzaDigital.Api/Controllers/Pos/PosSalesController.cs`
- `backend/src/CobranzaDigital.Api/Controllers/Pos/PosShiftsController.cs`
- `backend/src/CobranzaDigital.Api/Controllers/AuthController.cs`
- `backend/src/CobranzaDigital.Infrastructure/Identity/ApplicationUser.cs`
- `backend/src/CobranzaDigital.Infrastructure/Identity/IdentitySeeder.cs`
- `backend/src/CobranzaDigital.Infrastructure/Identity/IdentityService.cs`
- `backend/src/CobranzaDigital.Infrastructure/Identity/UserAdminService.cs`
- `backend/src/CobranzaDigital.Infrastructure/Services/JwtTokenService.cs`
- `backend/src/CobranzaDigital.Infrastructure/Services/TenantContextService.cs`
- `backend/src/CobranzaDigital.Infrastructure/Services/PosStoreContextService.cs`
- `backend/src/CobranzaDigital.Infrastructure/Services/PosSalesService.cs`
- `backend/tests/CobranzaDigital.Api.Tests/AdminContractsTests.cs`
- `backend/tests/CobranzaDigital.Api.Tests/TenantIsolationIntegrationTests.cs`

### Frontend
- `frontend/src/app/features/auth/services/auth.service.ts`
- `frontend/src/app/core/guards/role.guard.ts`
- `frontend/src/app/core/http/platform-tenant.interceptor.ts`
- `frontend/src/app/features/app-shell/app-shell.routes.ts`
- `frontend/src/app/features/app-shell/navigation/app-nav.config.ts`
- `frontend/src/app/features/admin/admin.routes.ts`
- `frontend/src/app/features/platform/platform.routes.ts`
- `frontend/src/app/features/pos/pos.routes.ts`
- `frontend/src/app/features/admin/services/admin-users.service.ts`
- `frontend/src/app/features/admin/pages/users-admin/users-admin.page.ts`
- `frontend/src/app/features/platform/services/platform-tenant-context.service.ts`
- `frontend/src/app/features/pos/services/store-context.service.ts`

### Docs contrastadas
- `docs/multi-tenant.md`
- `docs/pos-reports.md`
- `docs/release-b-contract-sheet.md`
- `docs/Corte-Implementacion.md`
- `frontend/docs/Corte-Implementacion-Front.md`
