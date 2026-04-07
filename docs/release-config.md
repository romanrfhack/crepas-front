# Release Configuration Contract

Este documento es la fuente de verdad para la Fase 1 del plan maestro.

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

Los tests API sobreescriben además los valores JWT con llaves deterministas de test.

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
- el build productivo del frontend compila con `production: true`.
