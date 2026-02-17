# CI/CD en monorepo

## CI único en root

El pipeline de CI vive en `/.github/workflows/ci.yml` y se ejecuta en:

- `pull_request` hacia `main`
- `push` a `main`
- `workflow_dispatch` manual

El workflow usa `dorny/paths-filter` para detectar cambios por área:

- `backend/**` (más archivos compartidos relevantes)
- `frontend/**` (más archivos compartidos relevantes)

Con base en esos cambios, ejecuta solo los jobs necesarios:

- `backend_tests`: restore/build/test de .NET con SQL Server en servicio
- `frontend_tests`: build/test/e2e de frontend con Playwright

## Deploy gated por CI exitoso

Los workflows de deploy están en root y **no** dependen de branch protection:

- `/.github/workflows/deploy-api.yml`
- `/.github/workflows/deploy-web.yml`

Ambos se disparan por:

- `workflow_run` del workflow `CI` cuando termina en `success`
- `workflow_dispatch` manual para redeploy

Además, en modo `workflow_run`, cada deploy valida cambios en su carpeta:

- API despliega solo si hubo cambios en `backend/**`
- WEB despliega solo si hubo cambios en `frontend/**`

Si no hubo cambios, el workflow finaliza sin desplegar.
