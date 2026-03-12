# Inventory V2 Performance Checklist (PR4)

## Objetivo
Validar latencia p95 y estabilidad de `balances`/`movements` v2 con guardrails activos.

## 1) Preparación
1. Aplicar migraciones:
   - `dotnet ef database update --project backend/src/CobranzaDigital.Infrastructure --startup-project backend/src/CobranzaDigital.Api`
2. Levantar API local y habilitar feature flag `inventory.v2.enabled`.
3. Cargar data de prueba (productos/extras + ajustes) con al menos:
   - 10k balances por tienda
   - 100k movimientos por tienda

## 2) Smoke funcional
- `GET /api/v2/pos/inventory/balances?storeId={id}&page=1&pageSize=500` (debe clamp a `200`).
- `GET /api/v2/pos/inventory/balances?storeId={id}&onHandMax=0`.
- `GET /api/v2/pos/inventory/movements?storeId={id}&itemType=Product&itemId={id}&page=1&pageSize=500` (debe clamp a `200`).

## 3) Medición p95
Ejecutar dos rondas (antes y después):
- balances: 200 requests con combinación de filtros (`q`, `tracked`, `categoryId`, `onHandMax`).
- movements: 200 requests con rango de 30 días + filtros opcionales (`reason`, `referenceType`).

Registrar:
- p50 / p95 / p99
- tamaño de respuesta promedio
- CPU/DB time observado

## 4) Query shape e índices (SQL Server)
```sql
-- índices esperados PR4
SELECT i.name, OBJECT_NAME(i.object_id) AS table_name
FROM sys.indexes i
WHERE OBJECT_NAME(i.object_id) IN ('CatalogInventoryBalances', 'CatalogInventoryAdjustments')
ORDER BY table_name, i.name;

-- top consultas de inventario (si query store está habilitado)
SELECT TOP 20
    qt.query_sql_text,
    rs.avg_duration,
    rs.last_duration,
    rs.count_executions
FROM sys.query_store_query_text qt
JOIN sys.query_store_query q ON q.query_text_id = qt.query_text_id
JOIN sys.query_store_plan p ON p.query_id = q.query_id
JOIN sys.query_store_runtime_stats rs ON rs.plan_id = p.plan_id
WHERE qt.query_sql_text LIKE '%CatalogInventoryBalances%'
   OR qt.query_sql_text LIKE '%CatalogInventoryAdjustments%'
ORDER BY rs.avg_duration DESC;
```

## 5) Criterio de aceptación PR4
- Guardrails consistentes (`page>=1`, `pageSize<=200`, rango `<=366 días` en movements).
- Filtros operativos en balances (`onHandMin`, `onHandMax`).
- p95 no empeora vs baseline y preferentemente mejora.
