# Multi-tenant Release A (backend)

## Definiciones

- **Vertical**: industria/giro (restaurant, farmacia, etc.).
- **Tenant**: organización cliente dentro de la plataforma.
- **Store**: sucursal operativa de un tenant.

## Resolución de tenant

- El backend usa claim JWT `tenantId` para usuarios tenant.
- Si el claim no viene, `TenantContextService` intenta resolverlo desde `AspNetUsers.TenantId`.
- `ITenantContext` expone:
  - `TenantId`: tenant propio del usuario (`null` para `SuperAdmin`).
  - `EffectiveTenantId`: tenant efectivo del request (override por `X-Tenant-Id` o `tenantId` query para `SuperAdmin`).
  - `IsPlatformAdmin`: `true` para rol `SuperAdmin`.
- Usuarios `SuperAdmin` pueden operar en modo plataforma global (`EffectiveTenantId = null`) o modo tenant explícito enviando `X-Tenant-Id: <guid>`.

## Reglas de scoping

- Endpoints POS requieren tenant (`TenantScoped`) y validan que `storeId` pertenezca al tenant actual.
- Si se envía un `storeId` de otro tenant, el backend responde `404`.
- `Sale`, `PosShift` y `Store` persisten `TenantId` para aislamiento.

## Reglas de plataforma y override

| Endpoint / grupo                                                                                   | SuperAdmin sin `X-Tenant-Id`                                  | SuperAdmin con `X-Tenant-Id` |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------- |
| Reportes agregados (`kpis/summary`, `sales/daily`, `payments/methods`, `control/cash-differences`) | ✅ permitido (cross-tenant)                                   | ✅ tenant específico         |
| Operativos (`/pos/sales`, `/pos/shifts`, `/pos/admin/*`)                                           | ❌ `400 tenantId required for this endpoint in platform mode` | ✅ permitido                 |
| `GET /pos/catalog/snapshot` sin `storeId`                                                          | ❌ `400 tenantId required for this endpoint in platform mode` | ✅ permitido                 |
| `GET /pos/catalog/snapshot` con `storeId`                                                          | ✅ permitido (resuelve por store)                             | ✅ permitido                 |

Notas:

- Usuarios tenant normales no pueden usar override a otro tenant; si envían `X-Tenant-Id` distinto reciben `403`.
- Los endpoints `/api/v1/platform/*` se mantienen con policy `PlatformOnly`.

## Roles

- **SuperAdmin**: acceso a `/api/v1/platform/*` (`PlatformOnly`).
- **TenantAdmin / Manager / AdminStore**: operación y reportes POS dentro de su tenant.
- **Cashier**: operación POS, sin acceso a plataforma.

## Plataforma UI (SuperAdmin)

- La sección `/app/platform` permite CRUD de verticals y tenants usando `/api/v1/platform/verticals` y `/api/v1/platform/tenants`.
- Desde la tabla de tenants se puede activar "Usar este tenant" para setear `platform_selected_tenant_id` (tenant-context usado por endpoints POS operativos).
- Si se elimina el tenant activo desde Plataforma, el frontend limpia tenant-context para evitar headers `X-Tenant-Id` inválidos.

## Modelo final de roles para administración de usuarios

- `SuperAdmin`: alcance global de usuarios (todos los tenants/stores).
- `TenantAdmin`: alcance completo dentro de su `tenantId`.
- `AdminStore`: alcance restringido a su `storeId` (y tenant asociado).
- `Manager` y `Cashier`: sin acceso a `/api/v1/admin/users`.

### Claims de scoping

- JWT mantiene `tenantId` cuando corresponde.
- JWT agrega `storeId` cuando el usuario tiene sucursal asignada.

### Reglas de asignación

- Roles `AdminStore`/`Manager`/`Cashier` requieren usuario con `StoreId` válido.
- Si existe `StoreId`, backend valida pertenencia de la store al `TenantId` del usuario.

## Platform Dashboard v1 (SuperAdmin cross-tenant)

Se agregan endpoints globales para Dashboard de Plataforma en `GET /api/v1/platform/dashboard/*`.

- Policy: `PlatformOnly` (solo `SuperAdmin`).
- No requieren header `X-Tenant-Id`.
- Operan en modo cross-tenant global.
- Agregados de tiempo (`summary`, `top-tenants`) usan UTC (`DateTimeOffset` en rango).

Endpoints v1:

- `GET /api/v1/platform/dashboard/summary`
- `GET /api/v1/platform/dashboard/top-tenants`
- `GET /api/v1/platform/dashboard/alerts`
- `GET /api/v1/platform/dashboard/recent-inventory-adjustments`
- `GET /api/v1/platform/dashboard/out-of-stock`

Contrato detallado en `docs/platform-dashboard-contract-sheet.md`.

## Frontend Plataforma Dashboard v1 (SuperAdmin)

- Nueva ruta: `/app/platform/dashboard` (lazy y protegida para `SuperAdmin`).
- Usa exclusivamente `/api/v1/platform/dashboard/*` en modo cross-tenant.
- Test ids contractuales clave:
  - Página/acciones: `platform-dashboard-page`, `platform-dashboard-refresh`
  - KPIs: `platform-kpi-*`
  - Bloques: `platform-top-tenants`, `platform-alerts`, `platform-recent-adjustments`, `platform-out-of-stock`
  - Errores por bloque: `platform-top-tenants-error`, `platform-alerts-error`, `platform-recent-adjustments-error`, `platform-out-of-stock-error`

## Frontend UX scoped user admin v2 (`/app/admin/users`)

- Badge de alcance visible por sesión:
  - `SuperAdmin` → `Vista global`
  - `TenantAdmin` → `Vista del tenant`
  - `AdminStore` → `Vista de sucursal`
- Filtros contractuales (`data-testid`):
  - `admin-users-filter-search`
  - `admin-users-filter-tenant`
  - `admin-users-filter-store`
- Scoping en UI:
  - `SuperAdmin`: tenant/store editables.
  - `TenantAdmin`: tenant fijo (deshabilitado), store editable dentro de su alcance.
  - `AdminStore`: store fijo (deshabilitado), sin cambio de tenant.
- Formulario inline de rol usa `admin-user-form-*` testids y muestra `admin-user-form-store-required` cuando el rol destino requiere `StoreId` (`AdminStore`, `Manager`, `Cashier`).

## Platform Dashboard v2 (SuperAdmin)

Se agregan endpoints ejecutivos cross-tenant sobre `/api/v1/platform/dashboard/*`:

- `GET /api/v1/platform/dashboard/sales-trend`
- `GET /api/v1/platform/dashboard/top-void-tenants`
- `GET /api/v1/platform/dashboard/stockout-hotspots`
- `GET /api/v1/platform/dashboard/activity-feed`
- `GET /api/v1/platform/dashboard/executive-signals`

Reglas v2:

- policy `PlatformOnly` (acceso exclusivo `SuperAdmin`).
- no requiere header `X-Tenant-Id`.
- agregados/rangos calculados en UTC para consistencia global.
- v1 (`summary`, `top-tenants`, `alerts`, `recent-inventory-adjustments`, `out-of-stock`) se mantiene intacto.

### Frontend Dashboard v2 (SuperAdmin)

La UI de `/app/platform/dashboard` extiende v1 sin romper bloques existentes y agrega secciones v2:

- `platform-executive-signals` con tarjetas `platform-executive-signal-*` y error `platform-executive-signals-error`.
- `platform-sales-trend` con filtros `platform-sales-trend-filter-date-from|date-to|granularity`, filas `platform-sales-trend-row-{index}` y error `platform-sales-trend-error`.
- `platform-top-void-tenants` con filtros `platform-top-void-tenants-filter-date-from|date-to|top`, filas `platform-top-void-tenant-row-{tenantId}` y error `platform-top-void-tenants-error`.
- `platform-stockout-hotspots` con filtros `platform-stockout-hotspots-filter-threshold|top|item-type`, filas `platform-stockout-hotspot-row-{storeId}` y error `platform-stockout-hotspots-error`.
- `platform-activity-feed` con filtros `platform-activity-feed-filter-take|event-type`, filas `platform-activity-feed-row-{index}` y error `platform-activity-feed-error`.

El botón global `platform-dashboard-refresh` vuelve a consultar bloques v1 + v2 de manera independiente (fallas aisladas por bloque).

## Platform Dashboard v3 (drill-down accionable)

Se agregan endpoints de detalle en `GET /api/v1/platform/dashboard/*`:

- `GET /api/v1/platform/dashboard/alerts/drilldown`
- `GET /api/v1/platform/dashboard/tenants/{tenantId}/overview`
- `GET /api/v1/platform/dashboard/stores/{storeId}/stockout-details`

Reglas:

- Mantienen `PlatformOnly` (`SuperAdmin`) y respuesta `403` para cualquier otro rol.
- No requieren `X-Tenant-Id` y operan cross-tenant.
- Son aditivos (no rompen contratos v1/v2).

Referencia de contrato: `docs/platform-dashboard-contract-sheet.md` (sección v3).

## Platform Dashboard v3 UI (SuperAdmin)

- La UI `/app/platform/dashboard` ahora permite drill-down accionable sin salir de la página:
  - Alertas: abre panel con `GET /api/v1/platform/dashboard/alerts/drilldown?code=...`.
  - Top tenants: abre overview con `GET /api/v1/platform/dashboard/tenants/{tenantId}/overview`.
  - Stockout hotspots: abre detalle de tienda con `GET /api/v1/platform/dashboard/stores/{storeId}/stockout-details` y filtros (`itemType`, `search`, `threshold`, `mode`, `take`).
- Acciones rápidas v3.1:
  - `STORE_WITHOUT_ADMINSTORE` → `/app/admin/users?tenantId={tenantId}&storeId={storeId}`.
  - `STORE_SCOPED_USER_WITHOUT_STORE` → `/app/admin/users?tenantId={tenantId}`.
  - `TENANT_WITHOUT_TEMPLATE` → `/app/platform/tenants` (sin prefill por query param en tenants v1 actual).
  - Tenant overview → botón `Ver usuarios del tenant` hacia `/app/admin/users?tenantId={tenantId}`.
  - Store stockout details → botón `Ver usuarios de la sucursal` hacia `/app/admin/users?tenantId={tenantId}&storeId={storeId}`.
- Test IDs estables añadidos para E2E:
  - Alert action: `platform-alert-drilldown-action-{code}-{index}`.
  - Alert action disabled: `platform-alert-drilldown-action-disabled-{code}-{index}`.
  - Tenant overview action: `platform-tenant-overview-action-users`.
  - Store stockout action: `platform-store-stockout-action-users`.


## Frontend UX admin users v3: creación contextual (prefill)

- En `/app/admin/users`, el botón `admin-users-create-open` abre formulario contextual usando filtros actuales y/o query params (`tenantId`, `storeId`).
- Heurística de sugerencia de rol (no forzada):
  - `tenantId + storeId` → `AdminStore` (o `Cashier` cuando el operador actual es `AdminStore`).
  - solo `tenantId` → `TenantAdmin`.
- Se mantienen testids contractuales para contexto y formulario (`admin-users-create-context-*`, `admin-user-form-*`).
- El frontend ya conecta submit real contra `POST /api/v1/admin/users`: envía `email`, `userName`, `role`, `tenantId`, `storeId`, `temporaryPassword`, muestra success/error por `ProblemDetails`, y refresca el listado scoped después de crear.


## Backend Admin Users v4: alta real (`POST /api/v1/admin/users`)

Contrato de request:

- `email` (required, único)
- `userName` (required, único)
- `role` (required; válidos para creación: `TenantAdmin`, `AdminStore`, `Manager`, `Cashier`)
- `tenantId` (required para todos los roles creados en v4)
- `storeId` (required para `AdminStore`/`Manager`/`Cashier`; opcional para `TenantAdmin`)
- `temporaryPassword` (required)

Contrato de response (201 Created):

- `id`, `email`, `userName`, `roles`, `tenantId`, `storeId`, `isLockedOut`

Reglas de autorización por actor:

- `SuperAdmin`: puede crear `TenantAdmin`, `AdminStore`, `Manager`, `Cashier` en cualquier tenant/store válido.
- `TenantAdmin`: puede crear los mismos roles, pero únicamente dentro de su propio tenant.
- `AdminStore`: solo puede crear `Manager`/`Cashier` y únicamente dentro de su misma store.
- `Manager`/`Cashier`: sin acceso por policy (`403`).

Validaciones de scoping:

- `storeId` debe pertenecer al `tenantId` informado.
- Intentos fuera de alcance del actor retornan `403`.
- Combinaciones inválidas de tenant/store retornan `400`.
- Email/username duplicados retornan `409`.

Auditoría:

- Se registra `AuditActions.CreateUser` (`Action = "CreateUser"`) con `EntityType = "User"` y metadatos de usuario creado.

Decisión de password inicial:

- `temporaryPassword` es obligatorio en el request.
- El usuario se crea activo y no bloqueado (`isLockedOut = false` por default).

## Backend Admin Users v5: reset password temporal (`POST /api/v1/admin/users/{id}/temporary-password`)

Contrato de request:

- `temporaryPassword` (required, mínimo 8 caracteres y validado contra policy de Identity).

Contrato de response (200 OK):

- `id`, `email`, `userName`, `roles`, `tenantId`, `storeId`, `message`.

Reglas de autorización por actor:

- `SuperAdmin`: puede resetear password temporal de `TenantAdmin`, `AdminStore`, `Manager`, `Cashier` en cualquier tenant/store válido.
- `TenantAdmin`: puede resetear `TenantAdmin`, `AdminStore`, `Manager`, `Cashier` únicamente dentro de su tenant.
- `AdminStore`: puede resetear solo `Manager`/`Cashier` y únicamente dentro de su store.
- `Manager`/`Cashier`: sin acceso por policy (`403`).

Reglas por usuario objetivo:

- No se permite resetear usuarios con rol `SuperAdmin` vía este endpoint.
- Si el target está fuera del scope tenant/store del actor, retorna `403`.
- Si el usuario no existe, retorna `404`.

Decisiones de estado:

- El endpoint solo actualiza password.
- No cambia lockout, tenant/store ni roles.

Auditoría:

- Se registra `AuditActions.ResetUserPassword` (`Action = "ResetUserPassword"`) con `EntityType = "User"`.
- Metadata incluye actor, target (`id/email/userName`), roles y scope (`tenantId`, `storeId`) con descriptor `action = "temporary password reset"`.
- Nunca se persiste el valor de `temporaryPassword` en auditoría/logs.

## Frontend Admin Users v5.1: reset password temporal desde `/app/admin/users`

- Se agrega acción por fila `Restablecer contraseña` con apertura de modal scoped (`admin-users-reset-password-open-{id}`).
- Submit real conectado a `POST /api/v1/admin/users/{id}/temporary-password` con contrato backend vigente:
  - Request: `{ temporaryPassword }`.
  - Response: `{ id, email, userName, roles, tenantId, storeId, message }`.
- Visibilidad/UI por scope:
  - `SuperAdmin`: target roles `TenantAdmin|AdminStore|Manager|Cashier`.
  - `TenantAdmin`: mismos roles pero dentro de tenant visible.
  - `AdminStore`: solo `Manager|Cashier` en su store visible.
- Validaciones frontend del modal:
  - required (`temporaryPassword` + confirmación),
  - mínimo 8,
  - confirmación coincidente,
  - anti doble click con estado loading.
- Manejo estable de `ProblemDetails` (`detail` y `errors`) para `400/403/404`.
- Test IDs contractuales agregados para UI-contract:
  - `admin-users-reset-password-modal`
  - `admin-users-reset-password-user`
  - `admin-users-reset-password-password`
  - `admin-users-reset-password-confirm`
  - `admin-users-reset-password-submit`
  - `admin-users-reset-password-cancel`
  - `admin-users-reset-password-error`
  - `admin-users-reset-password-success`

## Backend Admin Users v6: edición básica scoped (`PUT /api/v1/admin/users/{id}`)

Contrato de request:

- `userName` (required, único)
- `tenantId` (nullable, pero requerido cuando roles actuales del target lo exigen)
- `storeId` (nullable, pero requerido para roles actuales `AdminStore`/`Manager`/`Cashier`)

Contrato de response (200 OK):

- `id`, `email`, `userName`, `roles`, `tenantId`, `storeId`, `isLockedOut`, `lockoutEnd`

Reglas de autorización por actor:

- `SuperAdmin`: puede editar en cualquier tenant/store válido.
- `TenantAdmin`: solo usuarios de su tenant; no puede mover target a otro tenant.
- `AdminStore`: solo usuarios de su store; solo puede mantener tenant/store en su propio contexto.
- `Manager`/`Cashier`: sin acceso (`403`).

Reglas por roles actuales del target (sin cambiar roles en este endpoint):

- `TenantAdmin`: `tenantId` requerido, `storeId` opcional.
- `AdminStore` / `Manager` / `Cashier`: `tenantId` y `storeId` requeridos.
- Siempre se valida que `storeId` pertenezca a `tenantId`.

Errores esperados:

- `400`: validación (`userName` faltante, tenant/store inconsistentes, store fuera de tenant, store faltante para rol que lo requiere).
- `403`: fuera del scope actor.
- `404`: usuario no existe.
- `409`: conflicto por `userName` duplicado.

Auditoría:

- Se registra `AuditActions.UpdateUser` (`Action = "UpdateUser"`).
- Metadata incluye `before/after` de `userName`, `tenantId`, `storeId` y `roles` actuales del target.

Decisión v6 sobre email:

- **No se incluye cambio de `email`** en v6 para evitar riesgos de compatibilidad en normalización/confirmación de Identity.

## Frontend Admin Users v6: edición básica desde listado (`/app/admin/users`)

- Se agrega acción por fila `Editar` (`admin-users-edit-open-{id}`) con modal/panel de edición.
- Prefill desde usuario objetivo: `userName`, `tenantId`, `storeId`.
- Submit real contra `PUT /api/v1/admin/users/{id}` y refresh de listado al éxito.
- Validaciones UI:
  - `userName` requerido.
  - `storeId` obligatorio visual cuando roles actuales del target lo requieren (`admin-user-edit-store-required`).
  - mapeo estable de `ProblemDetails` para `400/403/404/409`.
- Test IDs contractuales:
  - `admin-user-edit-form`
  - `admin-user-edit-username`
  - `admin-user-edit-tenant`
  - `admin-user-edit-store`
  - `admin-user-edit-store-required`
  - `admin-user-edit-submit`
  - `admin-user-edit-cancel`
  - `admin-user-edit-error`
  - `admin-user-edit-success`


## Platform Dashboard v3.2 quick actions (contextual user creation intent)

Extensión sobre v3.1 sin nuevos endpoints backend:

- Dashboard usa navegación a `/app/admin/users` con query params de contexto existentes (`tenantId`, `storeId`) y agrega intent de UI:
  - `intent=create-user`
  - `suggestedRole=<RoleName>`
- Casos mínimos:
  - `STORE_WITHOUT_ADMINSTORE` → `tenantId + storeId + intent=create-user + suggestedRole=AdminStore`.
  - Tenant overview → `tenantId + intent=create-user + suggestedRole=TenantAdmin`.
  - Store stockout details → `tenantId + storeId + intent=create-user` (MVP con sugerencia `Cashier` opcional).
- En `/app/admin/users`:
  - Si llega `intent=create-user`, abre automáticamente el formulario de alta contextual.
  - Aplica prefill de `tenantId/storeId` y sugerencia de rol (`suggestedRole`) cuando el rol sea asignable en el scope actual.
  - Al cerrar el formulario se limpia solo el estado de intent UI y se conservan filtros tenant/store.
- Limitación explícita de v3.2:
  - No se agrega CTA global de reset password desde dashboard sin `userId` real en payload del drill-down.

Test IDs contractuales nuevos/actualizados:

- Dashboard: `platform-alert-drilldown-action-create-adminstore-{index}`, `platform-tenant-overview-action-create-tenantadmin`, `platform-store-stockout-action-create-user`.
- Admin users: `admin-users-create-intent-active` y contexto/formulario existente (`admin-users-create-context-*`, `admin-user-form-*`).

## 2026-02-28 — Platform Stores/Tenants Admin v1 (backend)

Se agregan endpoints de administración operativa de stores (solo plataforma):

- `GET /api/v1/platform/tenants/{tenantId}/stores`
- `GET /api/v1/platform/stores/{storeId}`
- `PUT /api/v1/platform/stores/{storeId}`
- `PUT /api/v1/platform/tenants/{tenantId}/default-store`

Reglas:
- Policy `PlatformOnly` (`SuperAdmin` only), cross-tenant, sin requerir `X-Tenant-Id`.
- `hasAdminStore` se deriva estrictamente de usuarios con rol `AdminStore` en la store (no depende de rol legacy `Admin`).
- `PUT /platform/stores/{storeId}` solo edita campos básicos seguros (`name`, `timeZoneId`, `isActive`).
- `PUT /platform/tenants/{tenantId}/default-store` valida pertenencia `store -> tenant` y store activa.
- Auditoría obligatoria:
  - `UpdateStore` con before/after de campos editados.
  - `UpdateTenantDefaultStore` con before/after de `defaultStoreId`.

## 2026-02-28 — Platform Stores Admin v1 UI (SuperAdmin)

- Nuevas rutas frontend:
  - `/app/platform/tenants/:tenantId/stores`
  - `/app/platform/stores/:storeId`
- Origen de navegación:
  - En `/app/platform/tenants`, cada tenant agrega acción `Ver stores` (`tenant-view-stores-{tenantId}`).
- Quick actions de stores:
  - `Ver / Editar`, `Hacer principal`, `Ver usuarios`.
  - Si `hasAdminStore = false`, CTA `Crear AdminStore` navega a `/app/admin/users` con query params `tenantId`, `storeId`, `intent=create-user`, `suggestedRole=AdminStore`.
- Test IDs contractuales Stores Admin v1:
  - Listado: `platform-tenant-stores-page`, `platform-tenant-stores-row-{storeId}`, `platform-tenant-stores-default-{storeId}`, `platform-tenant-stores-has-admin-{storeId}`, `platform-tenant-stores-edit-{storeId}`, `platform-tenant-stores-set-default-{storeId}`, `platform-tenant-stores-users-{storeId}`, `platform-tenant-stores-create-adminstore-{storeId}`.
  - Detalle/edición: `platform-store-details-page`, `platform-store-details-name`, `platform-store-details-timezone`, `platform-store-details-default`, `platform-store-details-has-admin`, `platform-store-edit-open`, `platform-store-edit-form`, `platform-store-edit-name`, `platform-store-edit-timezone`, `platform-store-edit-submit`, `platform-store-edit-cancel`, `platform-store-edit-success`, `platform-store-edit-error`.

## Platform Tenant details/settings v1 (SuperAdmin)

Nuevos endpoints de plataforma para configuración de tenant en modo global:

- `GET /api/v1/platform/tenants/{tenantId}`
- `PUT /api/v1/platform/tenants/{tenantId}`

Reglas:
- `PlatformOnly` (`SuperAdmin` únicamente).
- Cross-tenant, sin requerir `X-Tenant-Id`.
- `403` para `TenantAdmin`, `AdminStore`, `Manager`, `Cashier`.

Contrato útil para frontend:
- Coexisten identificadores y campos amigables en details: `verticalId` + `verticalName`, `defaultStoreId` + `defaultStoreName`, `catalogTemplateId` + `catalogTemplateName`.
- Se incluyen métricas operativas por tenant: `storeCount`, `activeStoreCount`, `usersCount`, `usersWithoutStoreAssignmentCount`, `storesWithoutAdminStoreCount`.
- `PUT` permite editar: `name`, `slug`, `isActive`, `verticalId` (si válido); `defaultStoreId` permanece en endpoint dedicado (`PUT /platform/tenants/{tenantId}/default-store`).

Auditoría:
- `PUT` escribe acción `UpdateTenant` con before/after de campos editables.
