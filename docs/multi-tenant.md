# Multi-tenant Release A (backend)

## Definiciones
- **Vertical**: industria/giro (restaurant, farmacia, etc.).
- **Tenant**: organización cliente dentro de la plataforma.
- **Store**: sucursal operativa de un tenant.

## Resolución de tenant
- El backend usa claim JWT `tenantId` para usuarios tenant.
- Si el claim no viene, `TenantContextService` intenta resolverlo desde `AspNetUsers.TenantId`.
- Usuarios `SuperAdmin` operan en modo plataforma (`TenantId = null`).

## Reglas de scoping
- Endpoints POS requieren tenant (`TenantScoped`) y validan que `storeId` pertenezca al tenant actual.
- Si se envía un `storeId` de otro tenant, el backend responde `404`.
- `Sale`, `PosShift` y `Store` persisten `TenantId` para aislamiento.

## Roles
- **SuperAdmin**: acceso a `/api/v1/platform/*` (`PlatformOnly`).
- **TenantAdmin / Manager / Admin**: operación y reportes POS dentro de su tenant.
- **Cashier**: operación POS, sin acceso a plataforma.
