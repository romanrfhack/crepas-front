# Deployment Runbook

## Objetivo

Operar deploy y rollback de Fase 6 sin recompilar en deploy, sin migración implícita y con validación post-release real.

## Prerrequisitos

- `CI` verde sobre `main`.
- Secrets GitHub configurados:
  - `CD_SSH_HOST`
  - `CD_SSH_PORT`
  - `CD_SSH_KEY_B64`
  - `CD_USER`
  - `CD_WEB_PATH`
  - `CD_RELEASE_BASE_URL`
  - `CD_SMOKE_USER_EMAIL`
  - `CD_SMOKE_USER_PASSWORD`
  - `CD_SMOKE_TENANT_ID` opcional
  - `CD_SMOKE_STORE_ID` opcional
  - `CD_API_ENV_FILE` opcional
- Host API con `EnvironmentFile` shell-compatible (`KEY=value`) y servicio `cobranzadigital-api`.
- Binario `dotnet` disponible en el host API.

## Pre-deploy

1. Confirmar el `run_id` y `sha` exactos del `CI` aprobado.
2. Confirmar que el manifiesto de CI contiene el artefacto esperado:
   - `api-release-<sha>` para API
   - `web-release-<sha>` para WEB
3. Verificar que `health/live` y `health/ready` del entorno actual responden.
4. Confirmar credenciales del smoke y contexto tenant/store si el usuario de smoke es `SuperAdmin`.
5. Confirmar disponibilidad de backup/restore de base si el cambio toca migraciones.

## Deploy

### Automático

- `deploy-api.yml` y `deploy-web.yml` se disparan por `workflow_run` de `CI` exitoso en `main`.
- Si el manifiesto no marca artefacto para esa superficie, el workflow termina en skip.

### Manual redeploy

Usar `workflow_dispatch` solo con:

- `deploy_action=deploy`
- `ci_run_id=<run id de CI>`
- `release_sha=<sha aprobada>`

El workflow valida que:

- el run pertenece a `CI`
- terminó en `success`
- proviene de `main`
- el SHA coincide con el artefacto solicitado

## Qué hace el deploy API

1. Descarga `release-manifest-<sha>` y `api-release-<sha>`.
2. Extrae el release en `/var/www/cobranzadigital/api/releases/<releaseId>`.
3. Ejecuta migración formal:

```bash
export SUPPRESS_EF_PENDING_MODEL_CHANGES_WARNING=1
dotnet /var/www/cobranzadigital/api/releases/<releaseId>/CobranzaDigital.Api.dll --migrate-only
```

4. Hace swap atómico del symlink `publish`.
5. Reinicia `cobranzadigital-api`.
6. Conserva el release previo para rollback básico.
7. Ejecuta `scripts/release-smoke.sh`.

## Qué hace el deploy WEB

1. Descarga `release-manifest-<sha>` y `web-release-<sha>`.
2. Extrae el release en un directorio versionado junto al docroot.
3. Hace swap atómico del symlink del sitio.
4. Conserva el release previo para rollback básico.
5. Ejecuta `scripts/release-smoke.sh`.

## Verificación de versión WEB

La interfaz web muestra un indicador discreto de build en la parte baja del sidebar autenticado
y también en el login. El formato visible es:

```text
Web r<runNumber> · <shortSha>
```

Ejemplo:

```text
Web r353 · bf797d9
```

- `runNumber` corresponde a `GITHUB_RUN_NUMBER` del workflow que construyó el artefacto.
- `shortSha` corresponde a los primeros 7 caracteres de `GITHUB_SHA`.
- Al hacer click en el indicador se abre el detalle con versión de `package.json`, run id,
  commit completo, branch, entorno, fecha UTC de build y fuente.
- El botón `Copiar información de soporte` copia un resumen útil para soporte y diagnóstico.

El dato visible viene compilado en el bundle Angular para confirmar qué frontend está ejecutando
realmente el navegador. Además, el build genera `assets/build-info.json` para consultar la
última versión desplegada como archivo público.

El build info se genera automáticamente con `frontend/scripts/write-build-info.mjs` antes de
`npm run build`. En GitHub Actions usa `GITHUB_SHA`, `GITHUB_REF_NAME`, `GITHUB_RUN_NUMBER` y
`GITHUB_RUN_ID`; en local usa `git` cuando está disponible y marca la fuente como `local`.

Si un usuario no ve cambios después de deploy:

1. Pedirle que abra el indicador y comparta la información de soporte.
2. Comparar `Web r<runNumber> · <shortSha>` contra el `CI` aprobado.
3. Si el run o commit no coinciden, recargar la página y limpiar cache del navegador si persiste.

## Post-deploy

Debe quedar verde:

- `GET /health/live`
- `GET /health/ready`
- login real
- `GET /api/v1/pos/catalog/snapshot`
- `GET /api/v1/pos/shifts/current`
- `GET /api/v1/pos/reports/daily-summary`

Si el smoke falla:

1. Anotar el `correlationPrefix` que imprime `scripts/release-smoke.sh`.
2. Revisar logs del API:

```bash
journalctl -u cobranzadigital-api -n 200 --no-pager
```

3. Buscar el `X-Correlation-Id` o `CorrelationId=` emitido por el smoke.
4. Confirmar si falló:
   - salud (`health/ready`)
   - autenticación/login
   - contexto tenant/store
   - consulta POS/reportes

## Qué significa `health/ready`

- `health/live`: el proceso responde.
- `health/ready`: la app está lista para servir tráfico y la dependencia SQL responde.

Un `live=200` con `ready!=200` indica proceso vivo pero release no apto para tráfico normal.

## Logs y correlación

- El access log mínimo sale por `RequestLoggingMiddleware`.
- El nivel operativo quedó en `Information`.
- Cada request relevante debe poder rastrearse por `X-Correlation-Id`.
- El smoke inyecta su propio `X-Correlation-Id` para diagnóstico post-release.

## Rollback

### API / WEB

Usar `workflow_dispatch` con:

- `deploy_action=rollback`
- `rollback_release_id=<releaseId>` opcional

Si `rollback_release_id` se omite, el workflow usa el release previo retenido.

El rollback:

- solo cambia el symlink al release anterior
- no ejecuta migraciones hacia atrás
- vuelve a correr el smoke post-rollback

## Política de base de datos

- No existe rollback automático de schema/datos.
- Si el release previo sigue siendo compatible con el schema ya migrado, el rollback de binario es válido.
- Si no lo es, usar `forward-fix + restore` según backup del entorno.

## Validación manual mínima de handoff

- Otra persona debe poder identificar `run_id` + `sha` aprobados.
- Debe poder lanzar redeploy/rollback sin tocar source.
- Debe poder ubicar logs y seguir `X-Correlation-Id`.
- Debe entender cuándo un fallo de smoke exige rollback y cuándo exige restore/forward-fix.
