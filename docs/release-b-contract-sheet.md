# Release B — Hoja de contratos (Frontend Prompt)

> Fuente: contratos reales en controllers, DTOs, políticas y notas de compatibilidad del repo. No incluye supuestos.

## 1) Platform (SuperAdmin)

Base de ruta:
- `api/v1/platform/catalog-templates`
- Controller con `[Authorize(Policy = AuthorizationPolicies.PlatformOnly)]`.
- `PlatformOnly` requiere rol `SuperAdmin`.

### 1.1 Endpoints `catalog-templates`

| Método | Ruta | Auth / policy | Headers / query | Request DTO | Response DTO |
|---|---|---|---|---|---|
| GET | `/api/v1/platform/catalog-templates` | `Bearer` + `PlatformOnly` (`SuperAdmin`) | Query opcional: `verticalId: Guid` | N/A | `200 OK` → `CatalogTemplate[]` (entidad) |
| POST | `/api/v1/platform/catalog-templates` | `Bearer` + `PlatformOnly` (`SuperAdmin`) | — | `UpsertCatalogTemplateRequest` | `200 OK` → `CatalogTemplate` |
| PUT | `/api/v1/platform/catalog-templates/{id}` | `Bearer` + `PlatformOnly` (`SuperAdmin`) | Path: `id: Guid` | `UpsertCatalogTemplateRequest` | `200 OK` → `CatalogTemplate`; `404 NotFound` si no existe |

### 1.2 Subruta de asignación template → tenant

| Método | Ruta exacta | Auth / policy | Headers / query | Request DTO | Response |
|---|---|---|---|---|---|
| PUT | `/api/v1/platform/catalog-templates/tenants/{tenantId}` | `Bearer` + `PlatformOnly` (`SuperAdmin`) | Path: `tenantId: Guid` | `AssignTenantCatalogTemplateRequest` | `204 NoContent` |

### 1.3 Tipos (DTO/Entidad) usados por Platform

`UpsertCatalogTemplateRequest`
```ts
{
  verticalId: string; // Guid
  name: string;
  version: string | null;
  isActive?: boolean; // default true
}
```

`AssignTenantCatalogTemplateRequest`
```ts
{
  catalogTemplateId: string; // Guid
}
```

`CatalogTemplate` (response actual del controller, entidad de dominio)
```ts
{
  id: string; // Guid
  verticalId: string; // Guid
  name: string;
  version: string | null;
  isActive: boolean;
  createdAtUtc: string; // DateTimeOffset
  updatedAtUtc: string; // DateTimeOffset
}
```

---

## 2) Tenant Admin POS

Base de ruta controller:
- `api/v1/pos/admin`
- Policies activas en cascada:
  - `TenantOrPlatform` (tenant claim **o** `SuperAdmin`)
  - `PosAdmin` (roles: `Admin`, `Manager`, `TenantAdmin`)
- Además, filtro `RequireTenantSelectionForOperation`:
  - Si usuario es `SuperAdmin` en modo platform y no se resolvió tenant efectivo, devuelve `400` con title/detail: `tenantId required for this endpoint in platform mode`.

### 2.1 Endpoints `catalog/overrides`

| Método | Ruta | Auth / policy | Headers / query | Request DTO | Response DTO |
|---|---|---|---|---|---|
| GET | `/api/v1/pos/admin/catalog/overrides` | `Bearer` + `TenantOrPlatform` + `PosAdmin` | Query opcional: `type: string` (filtra solo si parsea a `CatalogItemType`) | N/A | `200 OK` → `CatalogItemOverrideDto[]` |
| PUT | `/api/v1/pos/admin/catalog/overrides` | `Bearer` + `TenantOrPlatform` + `PosAdmin` | Tenant requerido para operación (ver condicional SuperAdmin) | `UpsertCatalogItemOverrideRequest` | `200 OK` → `CatalogItemOverrideDto` |

**PATCH en overrides:** no existe endpoint `PATCH` en controller actual.

### 2.2 Endpoints `catalog/availability`

| Método | Ruta | Auth / policy | Headers / query | Request DTO | Response DTO |
|---|---|---|---|---|---|
| PUT | `/api/v1/pos/admin/catalog/availability` | `Bearer` + `TenantOrPlatform` + `PosAdmin` | Tenant requerido para operación (ver condicional SuperAdmin) | `UpsertCatalogStoreAvailabilityRequest` | `200 OK` → `CatalogStoreAvailabilityDto` |

**GET/PATCH en availability:** no existen endpoints `GET` ni `PATCH` en controller actual.

### 2.3 Tipos (DTO) usados por POS Admin

`CatalogItemType` válido (string, case-insensitive en backend):
- `"Product" | "Extra" | "OptionItem"`

`UpsertCatalogItemOverrideRequest`
```ts
{
  itemType: "Product" | "Extra" | "OptionItem" | string;
  itemId: string; // Guid
  isEnabled: boolean;
}
```

`CatalogItemOverrideDto`
```ts
{
  itemType: string;
  itemId: string; // Guid
  isEnabled: boolean;
  updatedAtUtc: string; // DateTimeOffset
}
```

`UpsertCatalogStoreAvailabilityRequest`
```ts
{
  storeId: string; // Guid (requerido en body, no query)
  itemType: "Product" | "Extra" | "OptionItem" | string;
  itemId: string; // Guid
  isAvailable: boolean;
}
```

`CatalogStoreAvailabilityDto`
```ts
{
  storeId: string; // Guid
  itemType: string;
  itemId: string; // Guid
  isAvailable: boolean;
  updatedAtUtc: string; // DateTimeOffset
}
```

### 2.4 Condiciones y validaciones relevantes (para prompt frontend)

- `X-Tenant-Id`:
  - Solo lo puede usar `SuperAdmin` para override de tenant.
  - Si viene inválido (no GUID) => error de validación.
  - Alternativa equivalente: query `tenantId` (también GUID).
- Para endpoints POS admin, `SuperAdmin` sin tenant efectivo (`X-Tenant-Id` o `tenantId`) recibe `400` con mensaje fijo.
- `GET /catalog/overrides?type=`:
  - si `type` no parsea a enum, backend **no falla**; simplemente no aplica filtro por tipo.
- `PUT /catalog/overrides` y `PUT /catalog/availability`:
  - si `itemType` inválido => `ValidationException` (`itemType is invalid.`).
- `PUT /catalog/availability`:
  - valida que `storeId` pertenezca al tenant efectivo; si no, `Forbidden` (`Store does not belong to tenant.`).

---

## 3) Snapshot relacionado a Release B (condicionales importantes)

Aunque no fue pedido en la lista A/B, Release B también cambia contrato de snapshot y es clave para frontend:

- `GET /api/v1/pos/catalog/snapshot?storeId={optional}`
- Auth: `TenantOrPlatform` + `PosOperator`.
- ETag condicional:
  - Responde headers `ETag` y `Cache-Control: public, max-age=60`.
  - Si `If-None-Match` coincide exacto con ETag actual → `304 Not Modified` sin body.
- Campos nuevos no rompientes en `CatalogSnapshotDto`: `tenantId`, `verticalId`, `catalogTemplateId`.
