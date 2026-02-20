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
- **TenantAdmin / Manager / Admin**: operación y reportes POS dentro de su tenant.
- **Cashier**: operación POS, sin acceso a plataforma.
