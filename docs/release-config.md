# Release Configuration Contract

Este documento es la fuente de verdad para configuración de release y hardening operativo.

## Decisiones activas

- Producción opera same-origin con `/api`.
- Backend:
  - `Development`: `dotnet user-secrets`
  - `CI/Test`: variables del workflow
  - `Production`: variables de entorno o `EnvironmentFile` del host
- Frontend:
  - configuración pública por build-time
  - sin secretos embebidos
- Riesgo temporal aceptado en este sprint:
  - `access_token`, `refresh_token`, `platform_selected_tenant_id` y `pos_active_store_id` permanecen en `localStorage`
  - no se migra a cookies HttpOnly en esta fase

## Backend: variables requeridas

### Development

Configurar con `user-secrets` en `backend/src/CobranzaDigital.Api`:

```bash
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "<dev-sql-connection-string>"
dotnet user-secrets set "Jwt:SigningKey" "<32+ chars random signing key>"
```

Opcionales seguros:

```bash
dotnet user-secrets set "IdentitySeed:AdminEmail" "admin@local"
dotnet user-secrets set "IdentitySeed:AdminPassword" "<solo-si-se-necesita-seed-local>"
```

### CI / Test

El workflow debe inyectar:

- `TESTS_USE_SQLSERVER=1`
- `ConnectionStrings__DefaultConnection`
- `Jwt__SigningKey`

CI valida además migraciones reales ejecutando el binario con `--migrate-only`.

### Production

El host debe proveer como mínimo:

- `ConnectionStrings__DefaultConnection`
- `Jwt__SigningKey`

Recomendado explicitar también:

- `Jwt__Issuer`
- `Jwt__Audience`
- `DataProtection__KeysPath`

Debe permanecer deshabilitado en producción:

- `Swagger__Enabled`
- `DatabaseOptions__EnableSensitiveDataLogging`
- `APPLY_MIGRATIONS_ON_STARTUP`
- `SEED_DEV_DATA`

## Migraciones de release

Producción no usa auto-migrate al arrancar.

La migración formal del release se ejecuta explícitamente con el mismo binario publicado:

```bash
set -a
source /etc/cobranzadigital/api.env
set +a
dotnet /var/www/cobranzadigital/api/releases/<releaseId>/CobranzaDigital.Api.dll --migrate-only
```

Notas operativas:

- `api.env` debe ser shell-compatible (`KEY=value`) porque el deploy la hace `source`.
- si el archivo vive en otra ruta, `deploy-api.yml` admite `CD_API_ENV_FILE`.
- Desde Fase 7, CI y deploy ejecutan `--migrate-only` sin
  `SUPPRESS_EF_PENDING_MODEL_CHANGES_WARNING`.
- Validación Fase 7 del 2026-05-14: se confirmó drift de snapshot EF y se cerró con la
  migración no-op `20260514153113_F7PendingModelDrift`; no hubo DDL nuevo.
- `SUPPRESS_EF_PENDING_MODEL_CHANGES_WARNING=1` queda solo como break-glass temporal si
  producción está caída por un warning EF. Dueño: Release Owner. Expiración: retirar el mismo
  día mediante forward-fix o antes del siguiente release. Alcance: solo ejecución manual de
  `--migrate-only`, nunca CI ni deploy normal.

## Superficie Ruta A

- Ruta A de release contenido es single-tenant, single-store, single-caja y MVP no fiscal.
- Inventario soportado en release: la superficie legacy/actual usada por POS y reportes mínimos.
- Inventory V2 queda diferido: `inventory.v2.enabled=false` en backend y
  `inventoryV2Enabled=false` en frontend productivo.
- `/app/admin/pos/inventory-legacy` queda como compatibilidad controlada por
  `legacyInventoryEnabled` o rol `SuperAdmin`; no es la ruta principal de release.
- Endpoints demo/template (`AuthorizationDemoController`, `WeatherForecastController`) quedan
  fuera del release normal y solo se publican si `Release:EnableDemoEndpoints=true`.

## Política de rollback de datos

La política explícita para Fase 6 es:

- rollback de binario/API o WEB: permitido vía symlink al release previo retenido;
- rollback de base de datos: **no** se automatiza;
- si la migración ya alteró esquema/datos y el release previo no es compatible, operar con `forward-fix + restore` según backup del entorno.

En otras palabras:

- si el release previo sigue siendo compatible con el esquema actual, se puede revertir binario;
- si no lo es, la ruta segura es restaurar respaldo o corregir hacia adelante.

## Frontend: contrato de release

- El build productivo debe usar `src/environments/environment.prod.ts`.
- `production` debe compilar como `true`.
- `apiBaseUrl` se mantiene en `/api`.
- No deben quedar `console.*` operativos en flujos release de auth/POS.
- La UI no debe mostrar correlation id en producción.

## Host manual: EnvironmentFile sugerido

Ejemplo de archivo fuera del repo, por ejemplo `/etc/cobranzadigital/api.env`:

```ini
ConnectionStrings__DefaultConnection=<production-sql-connection-string>
Jwt__SigningKey=<32+ chars random signing key>
Jwt__Issuer=CobranzaDigital
Jwt__Audience=CobranzaDigital.Api
DataProtection__KeysPath=/var/www/cobranzadigital/api/keys
```

Después, el servicio systemd del host debe referenciar ese archivo con `EnvironmentFile=`.

## Secrets operativos de smoke

Los deploys requieren además:

- `CD_RELEASE_BASE_URL`
- `CD_SMOKE_USER_EMAIL`
- `CD_SMOKE_USER_PASSWORD`
- `CD_SMOKE_TENANT_ID` opcional
- `CD_SMOKE_STORE_ID` opcional

## Checklist de rotación y contención

1. Rotar de inmediato la credencial SQL expuesta históricamente.
2. Rotar cualquier `Jwt__SigningKey` que haya sido usada con defaults conocidos o configuraciones trackeadas.
3. Confirmar que el host productivo ya no depende de secretos dentro del artefacto publicado.
4. Verificar acceso mínimo al archivo `EnvironmentFile` en host.
5. Confirmar que los secretos rotados ya no existen en HEAD ni en documentación operativa activa.

## Validación de cierre de fase

La fase se considera cerrada solo si:

- no quedan secretos reales en archivos trackeados,
- backend arranca con `user-secrets` o variables externas,
- producción falla claramente si faltan `ConnectionStrings__DefaultConnection` o `Jwt__SigningKey`,
- Swagger está fuera de release comercial,
- HSTS queda activo en release,
- el build productivo del frontend compila con `production: true`,
- deploy API/WEB consume artefactos CI con SHA visible,
- el paso de migración es explícito,
- existe smoke post-deploy no mutante.
