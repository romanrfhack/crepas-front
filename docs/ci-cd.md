# CI/CD en monorepo

## CI único en root

El pipeline de CI vive en `/.github/workflows/ci.yml` y se ejecuta en:

- `push` a `main`
- `workflow_dispatch` manual

El workflow usa `dorny/paths-filter` con cuatro salidas:

- `backend_tests`: cualquier cambio relevante para validar backend y deploy API.
- `backend_release`: solo inputs reales del release backend (`backend/src/**`, `backend/global.json`, `backend/Directory.*`, `*.csproj|*.props|*.targets`, `CobranzaDigital.slnx`).
- `frontend_tests`: cualquier cambio relevante para validar frontend y deploy WEB.
- `frontend_release`: solo inputs reales del release frontend (`frontend/src/**`, `public/**`, `angular.json`, `package*.json`, `tsconfig*.json`).

Resultado esperado:

- cambios de SDK, paquetes o flags de build del backend sí disparan `backend_tests`;
- cambios solo de tests/docs ya no fuerzan deploy automático de binarios.

## Gate real de release

CI construye una vez y publica artefactos inmutables por SHA:

- `api-release-<sha>`
- `web-release-<sha>`
- `release-manifest-<sha>`

El manifiesto (`release-manifest.json`) contiene al menos:

- `releaseId`
- `sha`
- `runId`
- `runAttempt`
- flags `backendRelease` / `frontendRelease`
- nombre del artefacto consumible

Los deploys **no recompilan desde source**. Descargan el manifiesto y el artefacto del `run_id` aprobado, validan que el SHA coincide y fallan si el run no proviene de `CI` exitoso en `main`.

## Deploy API / WEB

Los workflows de deploy viven en:

- `/.github/workflows/deploy-api.yml`
- `/.github/workflows/deploy-web.yml`

Ambos soportan:

- `workflow_run` de `CI` cuando termina en `success` sobre `main`
- `workflow_dispatch` solo sobre `main`

`workflow_dispatch` ya no publica refs arbitrarios:

- `deploy_action=deploy` exige `ci_run_id` + `release_sha` de un `CI` exitoso en `main`
- `deploy_action=rollback` solo cambia al release previamente retenido o a un `release_id` explícito ya desplegado

## Estrategia de despliegue

### API

- Artefacto descargado desde CI
- release dir versionado en `/var/www/cobranzadigital/api/releases/<releaseId>`
- paso formal de migración con `dotnet CobranzaDigital.Api.dll --migrate-only`
- swap atómico del symlink `publish`
- conservación de release previo para rollback básico

### WEB

- Artefacto descargado desde CI
- release dir versionado en estado oculto junto a `CD_WEB_PATH`
- swap atómico del symlink del sitio
- conservación de release previo para rollback básico

## Smoke post-deploy

El smoke de release es `scripts/release-smoke.sh`.

No usa `ng serve` ni intercepts. Valida contra el entorno desplegado real:

- `GET /health/live`
- `GET /health/ready`
- login real
- catálogo POS
- turno actual
- reporte mínimo (`daily-summary`)

Los Playwright actuales quedan explícitamente como **UI-contract tests**, no como smoke de release.

## Secrets/inputs operativos requeridos

Además de los secrets SSH ya existentes, el flujo de release requiere:

- `CD_RELEASE_BASE_URL`
- `CD_SMOKE_USER_EMAIL`
- `CD_SMOKE_USER_PASSWORD`
- `CD_SMOKE_TENANT_ID` opcional
- `CD_SMOKE_STORE_ID` opcional
- `CD_API_ENV_FILE` opcional; default operativo: `/etc/cobranzadigital/api.env`

## Referencias operativas

- Contrato de configuración: [release-config.md](./release-config.md)
- Runbook de operación: [50-runbooks/deployment.md](./50-runbooks/deployment.md)
- Testing backend: [../backend/docs/testing.md](../backend/docs/testing.md)
