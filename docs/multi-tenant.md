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

| Endpoint / grupo | SuperAdmin sin `X-Tenant-Id` | SuperAdmin con `X-Tenant-Id` |
|---|---|---|
| Reportes agregados (`kpis/summary`, `sales/daily`, `payments/methods`, `control/cash-differences`) | ✅ permitido (cross-tenant) | ✅ tenant específico |
| Operativos (`/pos/sales`, `/pos/shifts`, `/pos/admin/*`) | ❌ `400 tenantId required for this endpoint in platform mode` | ✅ permitido |
| `GET /pos/catalog/snapshot` sin `storeId` | ❌ `400 tenantId required for this endpoint in platform mode` | ✅ permitido |
| `GET /pos/catalog/snapshot` con `storeId` | ✅ permitido (resuelve por store) | ✅ permitido |

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
- Se establecen `data-testid` contractuales para consumo E2E estable (drilldown open/close, title, rows, empty/error y filtros).
