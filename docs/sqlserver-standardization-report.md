# SQL Server Standardization Report

## 1) Hallazgos iniciales de SQLite (antes de la migración)

Se detectaron rastros de SQLite / modo mixto en los siguientes puntos:

- `backend/src/CobranzaDigital.Infrastructure/DependencyInjection.cs`
  - Uso de provider dinámico con rama `UseSqlite` y fallback para entorno `Testing`.
- `backend/src/CobranzaDigital.Infrastructure/CobranzaDigital.Infrastructure.csproj`
  - Referencia a `Microsoft.EntityFrameworkCore.Sqlite`.
- `backend/Directory.Packages.props`
  - Versión centralizada para `Microsoft.EntityFrameworkCore.Sqlite`.
- `backend/tests/CobranzaDigital.Api.Tests/SmokeTests.cs`
  - `WebApplicationFactory` con fallback a SQLite in-memory y settings `ConnectionStrings:Sqlite`.
- `backend/tests/CobranzaDigital.Api.Tests/CobranzaDigital.Api.Tests.csproj`
  - Referencia a `Microsoft.EntityFrameworkCore.Sqlite`.
- `backend/tests/CobranzaDigital.Application.Tests/PosCatalogValidationTests.cs`
  - Tests unitarios construyendo `DbContext` con `SqliteConnection` + `UseSqlite` en memoria.
- `backend/tests/CobranzaDigital.Application.Tests/CobranzaDigital.Application.Tests.csproj`
  - Referencia a `Microsoft.EntityFrameworkCore.Sqlite`.
- `backend/src/CobranzaDigital.Infrastructure/Services/PosShiftService.cs`
  - Ramas condicionales con `_db.Database.IsSqlite()`.
- `backend/docs/testing.md`
  - Uso de flags/variables antiguas (`TESTS_USE_SQLSERVER`, `ConnectionStrings__SqlServer`).

## 2) Cambios aplicados (estado final)

### Backend runtime
- El `DbContext` queda estandarizado a **SQL Server** (`UseSqlServer`) sin ramas condicionales por provider.
- `DatabaseOptions.ConnectionStringName` ahora apunta por defecto a `DefaultConnection`.
- `Program` usa infraestructura sin selector de provider.

### Configuración de conexión
- `appsettings.json` y `appsettings.Development.json` usan `ConnectionStrings:DefaultConnection`.
- Se eliminaron cadenas con contraseñas embebidas del repositorio.
- La sobreescritura para local/CI queda vía `ConnectionStrings__DefaultConnection`.

### Tests
- Integration tests (`CobranzaDigitalApiFactory`):
  - SQL Server obligatorio.
  - Catálogo único por corrida (`CrepasDB_Test_{Guid}`).
  - Migraciones automáticas.
  - Logs de catálogo base/final/provider.
  - Limpieza con `DROP DATABASE` al finalizar.
- Unit tests de aplicación migrados de SQLite in-memory a `EFCore.InMemory` para evitar dependencia de SQLite.

### CI
- Workflow `ci.yml` backend:
  - Conserva service container de SQL Server.
  - Usa `ConnectionStrings__DefaultConnection`.
  - Base de nombre único por `run_id`/`run_attempt` para evitar colisiones entre jobs.

## 3) PR plan / etapas (aplicado)

1. Auditoría de rastros SQLite y puntos de configuración.
2. Estandarización de DI/config a SQL Server-only.
3. Migración de integration tests a SQL Server-only con catálogo único y cleanup.
4. Migración de unit tests que dependían de SQLite.
5. Ajuste de workflow CI y documentación operativa.
6. Validación por búsqueda estática sin rastros SQLite.

## 4) Ejecución local/CI

### Local backend

1. Definir cadena por user-secrets (recomendado):

```bash
cd backend/src/CobranzaDigital.Api
dotnet user-secrets init
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=(localdb)\\MSSQLLocalDB;Database=CrepasDB;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true"
```

2. Ejecutar API:

```bash
cd /workspace/crepas-front/backend
dotnet run --project src/CobranzaDigital.Api
```

3. Ejecutar tests:

```bash
dotnet test CobranzaDigital.sln -c Release
```

### CI backend

- Inyectar `ConnectionStrings__DefaultConnection` (SQL Auth recomendado en CI).
- El job backend ya usa SQL Server service container.
- Los integration tests crean base única y la eliminan al finalizar.

## 5) Frontend: revisión de dependencia SQLite + propuesta offline-first (sin implementación)

### Revisión actual

- No se detectaron dependencias a SQLite ni supuestos de offline DB local en el frontend.

### Diseño propuesto offline-first

1. **Service Worker (assets + shell):**
   - Activar Angular Service Worker para cache de assets estáticos y rutas principales.
   - Estrategia: `performance` para assets versionados, `freshness` para datos dinámicos críticos.

2. **Persistencia local en IndexedDB (Dexie):**
   - Crear `OfflineStoreService` (wrapper Dexie) con tablas:
     - `pending_operations`
     - `entity_snapshots`
     - `sync_metadata`

3. **Cola de operaciones offline:**
   - Interceptor HTTP que detecte offline/errores de red (status 0/timeout), serialice la intención (método, endpoint, payload, idempotency-key) y la encole.
   - Respuesta optimista al UI con estado `pending_sync`.

4. **Sincronización al reconectar:**
   - Servicio `SyncOrchestratorService` suscrito a eventos `online` y timer/backoff.
   - Reintentos exponenciales con jitter.
   - Procesamiento FIFO por agregado para minimizar conflictos.

5. **Manejo de conflictos:**
   - Encabezados `If-Match`/`ETag` cuando aplique.
   - Estrategia de resolución por dominio:
     - Last-write-wins para catálogos de baja criticidad.
     - Merge/manual resolution para entidades transaccionales.

6. **Puntos de integración sugeridos:**
   - `core/http/offline-queue.interceptor.ts`
   - `core/services/offline-store.service.ts`
   - `core/services/sync-orchestrator.service.ts`
   - Estado visual en shell/header: `online`, `offline`, `syncing`, `sync-error`.
