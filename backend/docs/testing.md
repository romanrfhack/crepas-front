# Backend Testing Guide

## Prerrequisitos
- .NET SDK 10.0.x
- Docker (para SQL Server local)

## Levantar SQL Server local en Docker
```bash
docker run --name cobranzadigital-sql-test \
  -e ACCEPT_EULA=Y \
  -e MSSQL_SA_PASSWORD='YourStrong!Passw0rd' \
  -p 1433:1433 \
  -d mcr.microsoft.com/mssql/server:2022-latest
```

Opcional para reiniciar:
```bash
docker start cobranzadigital-sql-test
```

## Variables de entorno para Integration Tests API
```bash
export TESTS_USE_SQLSERVER=true
export ConnectionStrings__DefaultConnection='Server=localhost,1433;Database=CobranzaDigitalTests;User Id=sa;Password=YourStrong!Passw0rd;TrustServerCertificate=true;MultipleActiveResultSets=true'
```

## Ejecutar tests
Desde la raíz del repo:
```bash
dotnet restore backend/CobranzaDigital.sln
dotnet build backend/CobranzaDigital.sln -c Release --no-restore
dotnet test backend/CobranzaDigital.sln -c Release --no-build
```

## CI (GitHub Actions)
El workflow `.github/workflows/deploy-api.yml` ejecuta un job `test` con SQL Server service container antes del deploy.

Variables requeridas en GitHub Secrets:
- `CD_TEST_SQL_PASSWORD`: password de `sa` para el service container de SQL Server.
- Las credenciales de deploy ya existentes (`CD_SSH_HOST`, `CD_SSH_PORT`, `CD_SSH_KEY_B64`).
