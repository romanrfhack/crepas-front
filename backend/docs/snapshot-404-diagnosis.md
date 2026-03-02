# Diagnóstico fino: `/api/v1/pos/catalog/snapshot` (200 vs 404)

## Hallazgo principal

El `404 Resource not found` de este endpoint no viene de `Tenant`, `Store` o `CatalogTemplate` base dentro de `GetSnapshotAsync`; viene de la **resolución de tienda previa** (`PosStoreContextService.ResolveStoreAsync`) que usa `PosSettings` globales.

Flujo real:

1. `PosCatalogController.GetSnapshot` llama primero `ComputeCatalogEtagAsync`.
2. `ComputeCatalogEtagAsync` llama `_storeContext.ResolveStoreAsync(...)`.
3. Si `ResolveStoreAsync` no encuentra una tienda activa con `Id == storeIdResuelto` y `TenantId == tenantIdDelToken`, lanza `NotFoundException("Store was not found for current tenant.")`.
4. El middleware traduce cualquier `NotFoundException` a `404 Resource not found`.

## Ramas reales que producen 404 en este endpoint

Para `GET /api/v1/pos/catalog/snapshot`, las ramas observadas que devuelven 404 son:

1. **Store no encontrada para tenant actual** durante `ComputeCatalogEtagAsync`.
   - Método: `PosStoreContextService.ResolveStoreAsync`.
   - Condición exacta:
     - calcula `storeId` desde `PosSettings` (`DefaultStoreId` salvo caso multi-store + query), y
     - `NOT EXISTS Stores WHERE Id = storeId AND TenantId = EffectiveTenantId AND IsActive = 1`.
   - Excepción: `NotFoundException("Store was not found for current tenant.")`.

2. **Store no encontrada para tenant actual** durante `GetSnapshotAsync`.
   - Método: `PosStoreContextService.ResolveStoreAsync` (misma rama) cuando se vuelve a resolver la tienda antes de armar snapshot.

No se encontraron otras ramas `NotFoundException` dentro del camino de snapshot. El resto de fallos en esta ruta son 400/403/409/500 según el tipo de excepción.

## Qué NO estaba cubierto en el query base

Aunque validaste `Tenants`, `Stores`, `TenantCatalogTemplates` y `CatalogTemplates`, aún faltaba validar la regla crítica:

- **`PosSettings` (fila efectiva)** y su impacto en `storeId` resuelto:
  - `MultiStoreEnabled`
  - `DefaultStoreId`
  - correspondencia de `DefaultStoreId` contra `Stores.TenantId` del tenant del token.

Punto clave de lógica:

- El snapshot **no usa `user.StoreId` del cashier** para resolver tienda.
- Si no envías `?storeId=...`, el servicio toma `PosSettings.DefaultStoreId` incluso con `MultiStoreEnabled = 1` cuando `storeId` query viene nulo.
- Si ese `DefaultStoreId` pertenece a otro tenant, ese cashier cae en 404.

## SQL de segundo nivel (exacto al modelo real)

> SQL Server (nombres de tabla/columnas del proyecto)

```sql
/* =========================================================
   INPUTS
   ========================================================= */
DECLARE @GoodTenantId UNIQUEIDENTIFIER = 'b8beeed7-09a2-4832-9c05-b9239914040f';
DECLARE @GoodStoreId  UNIQUEIDENTIFIER = '968c650f-f226-4cbe-88ec-26d8370d307b';
DECLARE @BadTenantId  UNIQUEIDENTIFIER = 'f01ee77e-2adc-45ae-968d-da33e82bb867';
DECLARE @BadStoreId   UNIQUEIDENTIFIER = '6b482dfd-9b82-422e-9b47-c9489d985506';

/* =========================================================
   1) POS SETTINGS EFECTIVOS (rama más crítica para 404)
   El código usa TOP(1) ORDER BY Id
   ========================================================= */
SELECT TOP (1)
    ps.Id,
    ps.DefaultStoreId,
    ps.MultiStoreEnabled,
    ps.ShowOnlyInStock,
    ps.UpdatedAtUtc,
    s.TenantId AS DefaultStoreTenantId,
    s.IsActive AS DefaultStoreIsActive
FROM PosSettings ps
LEFT JOIN Stores s ON s.Id = ps.DefaultStoreId
ORDER BY ps.Id;

/* Consistencia del DefaultStore contra cada tenant (GOOD/BAD) */
SELECT
    x.CaseName,
    x.TenantId,
    ps.DefaultStoreId,
    s.TenantId AS DefaultStoreTenantId,
    s.IsActive AS DefaultStoreIsActive,
    CASE
        WHEN s.Id IS NULL THEN 'DEFAULT_STORE_MISSING'
        WHEN s.IsActive = 0 THEN 'DEFAULT_STORE_INACTIVE'
        WHEN s.TenantId <> x.TenantId THEN 'DEFAULT_STORE_OTHER_TENANT'
        ELSE 'OK'
    END AS DefaultStoreCheck
FROM (VALUES
    ('GOOD', @GoodTenantId),
    ('BAD' , @BadTenantId)
) x(CaseName, TenantId)
CROSS APPLY (
    SELECT TOP (1) *
    FROM PosSettings
    ORDER BY Id
) ps
LEFT JOIN Stores s ON s.Id = ps.DefaultStoreId;

/* =========================================================
   2) TenantCatalogTemplates / CatalogTemplates (incluye checks de actividad)
   ========================================================= */
SELECT
    x.CaseName,
    tct.TenantId,
    tct.CatalogTemplateId,
    tct.UpdatedAtUtc AS TenantCatalogTemplateUpdatedAtUtc,
    ct.VerticalId,
    ct.Name AS CatalogTemplateName,
    ct.Version,
    ct.IsActive AS CatalogTemplateIsActive,
    ct.UpdatedAtUtc AS CatalogTemplateUpdatedAtUtc
FROM (VALUES
    ('GOOD', @GoodTenantId),
    ('BAD' , @BadTenantId)
) x(CaseName, TenantId)
LEFT JOIN TenantCatalogTemplates tct ON tct.TenantId = x.TenantId
LEFT JOIN CatalogTemplates ct ON ct.Id = tct.CatalogTemplateId;

/* Duplicados históricos improbables (PK impide, pero útil en auditoría) */
SELECT TenantId, COUNT(*) AS RowsPerTenant
FROM TenantCatalogTemplates
WHERE TenantId IN (@GoodTenantId, @BadTenantId)
GROUP BY TenantId
HAVING COUNT(*) > 1;

/* =========================================================
   3) Conteo de items base por template activo (Productos/Extras/OptionItems)
   ========================================================= */
;WITH TenantTemplate AS (
    SELECT x.CaseName, x.TenantId, tct.CatalogTemplateId
    FROM (VALUES ('GOOD', @GoodTenantId), ('BAD', @BadTenantId)) x(CaseName, TenantId)
    JOIN TenantCatalogTemplates tct ON tct.TenantId = x.TenantId
)
SELECT
    tt.CaseName,
    tt.TenantId,
    tt.CatalogTemplateId,
    (SELECT COUNT(*) FROM Products p WHERE p.CatalogTemplateId = tt.CatalogTemplateId) AS ProductsTotal,
    (SELECT COUNT(*) FROM Products p WHERE p.CatalogTemplateId = tt.CatalogTemplateId AND p.IsActive = 1) AS ProductsActive,
    (SELECT COUNT(*) FROM Extras e WHERE e.CatalogTemplateId = tt.CatalogTemplateId) AS ExtrasTotal,
    (SELECT COUNT(*) FROM Extras e WHERE e.CatalogTemplateId = tt.CatalogTemplateId AND e.IsActive = 1) AS ExtrasActive,
    (SELECT COUNT(*) FROM OptionItems oi WHERE oi.CatalogTemplateId = tt.CatalogTemplateId) AS OptionItemsTotal,
    (SELECT COUNT(*) FROM OptionItems oi WHERE oi.CatalogTemplateId = tt.CatalogTemplateId AND oi.IsActive = 1) AS OptionItemsActive
FROM TenantTemplate tt;

/* =========================================================
   4) Overrides y availability secundarios usados alrededor del snapshot
   Nota: snapshot usa TenantCatalogOverrides + StoreCatalogOverrides.
         StoreCatalogAvailability existe, pero snapshot actual no lo consume.
   ========================================================= */

/* TenantCatalogOverrides */
SELECT
    x.CaseName,
    tco.ItemType,
    COUNT(*) AS RowsCount,
    SUM(CASE WHEN tco.IsEnabled = 0 THEN 1 ELSE 0 END) AS DisabledCount,
    MAX(tco.UpdatedAtUtc) AS LastUpdated
FROM (VALUES ('GOOD', @GoodTenantId), ('BAD', @BadTenantId)) x(CaseName, TenantId)
LEFT JOIN TenantCatalogOverrides tco ON tco.TenantId = x.TenantId
GROUP BY x.CaseName, tco.ItemType
ORDER BY x.CaseName, tco.ItemType;

/* StoreCatalogOverrides */
SELECT
    x.CaseName,
    sco.ItemType,
    sco.OverrideState,
    COUNT(*) AS RowsCount,
    MAX(sco.UpdatedAtUtc) AS LastUpdated
FROM (VALUES
    ('GOOD', @GoodTenantId, @GoodStoreId),
    ('BAD' , @BadTenantId , @BadStoreId)
) x(CaseName, TenantId, StoreId)
LEFT JOIN StoreCatalogOverrides sco
    ON sco.StoreId = x.StoreId
   AND sco.TenantId = x.TenantId
GROUP BY x.CaseName, sco.ItemType, sco.OverrideState
ORDER BY x.CaseName, sco.ItemType, sco.OverrideState;

/* StoreCatalogAvailability (tabla potencialmente relevante para otros flujos) */
SELECT
    x.CaseName,
    sca.ItemType,
    COUNT(*) AS RowsCount,
    SUM(CASE WHEN sca.IsAvailable = 0 THEN 1 ELSE 0 END) AS MarkedUnavailable,
    MAX(sca.UpdatedAtUtc) AS LastUpdated
FROM (VALUES
    ('GOOD', @GoodStoreId),
    ('BAD' , @BadStoreId)
) x(CaseName, StoreId)
LEFT JOIN StoreCatalogAvailability sca ON sca.StoreId = x.StoreId
GROUP BY x.CaseName, sca.ItemType
ORDER BY x.CaseName, sca.ItemType;

/* =========================================================
   5) Inventory balances usados por snapshot (OutOfStock / ShowOnlyInStock)
   ========================================================= */
SELECT
    x.CaseName,
    cib.ItemType,
    COUNT(*) AS RowsCount,
    SUM(CASE WHEN cib.OnHandQty <= 0 THEN 1 ELSE 0 END) AS NonPositiveStockRows,
    MAX(cib.UpdatedAtUtc) AS LastUpdated
FROM (VALUES
    ('GOOD', @GoodTenantId, @GoodStoreId),
    ('BAD' , @BadTenantId , @BadStoreId)
) x(CaseName, TenantId, StoreId)
LEFT JOIN CatalogInventoryBalances cib
    ON cib.TenantId = x.TenantId
   AND cib.StoreId = x.StoreId
GROUP BY x.CaseName, cib.ItemType
ORDER BY x.CaseName, cib.ItemType;

/* Integridad relacional de StoreCatalogOverrides -> item real de template */
;WITH Cases AS (
    SELECT 'GOOD' AS CaseName, @GoodTenantId AS TenantId, @GoodStoreId AS StoreId
    UNION ALL
    SELECT 'BAD', @BadTenantId, @BadStoreId
),
Tpl AS (
    SELECT c.CaseName, c.TenantId, c.StoreId, tct.CatalogTemplateId
    FROM Cases c
    JOIN TenantCatalogTemplates tct ON tct.TenantId = c.TenantId
)
SELECT
    t.CaseName,
    sco.Id AS StoreOverrideId,
    sco.ItemType,
    sco.ItemId,
    sco.OverrideState,
    CASE
        WHEN sco.ItemType = 0 AND p.Id IS NULL THEN 'BROKEN_PRODUCT_REF'
        WHEN sco.ItemType = 1 AND e.Id IS NULL THEN 'BROKEN_EXTRA_REF'
        WHEN sco.ItemType = 2 AND oi.Id IS NULL THEN 'BROKEN_OPTIONITEM_REF'
        ELSE 'OK'
    END AS RefCheck
FROM Tpl t
JOIN StoreCatalogOverrides sco
  ON sco.TenantId = t.TenantId
 AND sco.StoreId = t.StoreId
LEFT JOIN Products p
  ON sco.ItemType = 0 AND p.Id = sco.ItemId AND p.CatalogTemplateId = t.CatalogTemplateId
LEFT JOIN Extras e
  ON sco.ItemType = 1 AND e.Id = sco.ItemId AND e.CatalogTemplateId = t.CatalogTemplateId
LEFT JOIN OptionItems oi
  ON sco.ItemType = 2 AND oi.Id = sco.ItemId AND oi.CatalogTemplateId = t.CatalogTemplateId
ORDER BY t.CaseName, sco.ItemType, sco.ItemId;
```

## SQL comparativo GOOD vs BAD (foco diferencias secundarias)

```sql
DECLARE @GoodTenantId UNIQUEIDENTIFIER = 'b8beeed7-09a2-4832-9c05-b9239914040f';
DECLARE @GoodStoreId  UNIQUEIDENTIFIER = '968c650f-f226-4cbe-88ec-26d8370d307b';
DECLARE @BadTenantId  UNIQUEIDENTIFIER = 'f01ee77e-2adc-45ae-968d-da33e82bb867';
DECLARE @BadStoreId   UNIQUEIDENTIFIER = '6b482dfd-9b82-422e-9b47-c9489d985506';

;WITH Cases AS (
    SELECT 'GOOD' AS CaseName, @GoodTenantId AS TenantId, @GoodStoreId AS StoreId
    UNION ALL
    SELECT 'BAD', @BadTenantId, @BadStoreId
),
FirstSettings AS (
    SELECT TOP (1) * FROM PosSettings ORDER BY Id
),
TemplateByCase AS (
    SELECT c.CaseName, c.TenantId, c.StoreId, tct.CatalogTemplateId
    FROM Cases c
    LEFT JOIN TenantCatalogTemplates tct ON tct.TenantId = c.TenantId
),
Summary AS (
    SELECT
        c.CaseName,
        c.TenantId,
        c.StoreId,
        fs.DefaultStoreId,
        fs.MultiStoreEnabled,
        fs.ShowOnlyInStock,
        sdef.TenantId AS DefaultStoreTenantId,
        sdef.IsActive AS DefaultStoreActive,
        t.CatalogTemplateId,
        ct.IsActive AS TemplateActive,
        (SELECT COUNT(*) FROM TenantCatalogOverrides tco WHERE tco.TenantId = c.TenantId) AS TenantOverrides,
        (SELECT COUNT(*) FROM TenantCatalogOverrides tco WHERE tco.TenantId = c.TenantId AND tco.IsEnabled = 0) AS TenantDisabled,
        (SELECT COUNT(*) FROM StoreCatalogOverrides sco WHERE sco.TenantId = c.TenantId AND sco.StoreId = c.StoreId) AS StoreOverrides,
        (SELECT COUNT(*) FROM CatalogInventoryBalances cib WHERE cib.TenantId = c.TenantId AND cib.StoreId = c.StoreId) AS InventoryRows,
        (SELECT COUNT(*) FROM Products p WHERE p.CatalogTemplateId = t.CatalogTemplateId AND p.IsActive = 1) AS ActiveProducts,
        (SELECT COUNT(*) FROM Extras e WHERE e.CatalogTemplateId = t.CatalogTemplateId AND e.IsActive = 1) AS ActiveExtras,
        (SELECT COUNT(*) FROM OptionItems oi WHERE oi.CatalogTemplateId = t.CatalogTemplateId AND oi.IsActive = 1) AS ActiveOptionItems
    FROM Cases c
    CROSS JOIN FirstSettings fs
    LEFT JOIN Stores sdef ON sdef.Id = fs.DefaultStoreId
    LEFT JOIN TemplateByCase t ON t.CaseName = c.CaseName
    LEFT JOIN CatalogTemplates ct ON ct.Id = t.CatalogTemplateId
)
SELECT *
FROM Summary
ORDER BY CaseName;
```

## Guía corta de interpretación

1. Si `DefaultStoreCheck = DEFAULT_STORE_OTHER_TENANT` para BAD, ya tienes explicación directa del 404.
2. Si `DefaultStoreCheck = OK` para ambos, entonces revisa si el cliente manda `storeId` query y si `MultiStoreEnabled` lo está ignorando en práctica (nulo en query => cae a default).
3. Si template o items activos salen en cero, eso explica snapshot vacío o degradado, **pero no el 404**.
4. Si aparecen referencias rotas en overrides/inventory, eso apunta a riesgo de errores 500 o comportamientos raros, no al 404 principal reportado.

## Hipótesis más probable ahora

**Alta probabilidad:** BAD está resolviendo un `storeId` efectivo desde `PosSettings.DefaultStoreId` que no pertenece a su tenant (o está inactivo), por eso falla en `ResolveStoreAsync` y se transforma en `404 Resource not found`.

## Bug potencial de código (a validar luego)

1. `PosSettings` parece global (sin `TenantId`) y se toma `TOP(1) ORDER BY Id`; en entorno multi-tenant eso puede mezclar contexto entre tenants.
2. La resolución de tienda en snapshot no considera `user.StoreId` del cashier ni claim de store; depende de query param + configuración global.
3. `StoreCatalogAvailability` tiene endpoints propios, pero snapshot no la utiliza actualmente (podría ser brecha de diseño/expectativa funcional).
