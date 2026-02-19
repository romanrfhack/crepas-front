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

## Variables de entorno para Integration Tests API (solo sesión actual)

### Bash / zsh
```bash
export TESTS_USE_SQLSERVER=1
export ConnectionStrings__DefaultConnection='Server=localhost,1433;Database=CrepasDB_Test_Base;User Id=sa;Password=YourStrong!Passw0rd;Encrypt=True;TrustServerCertificate=True;MultipleActiveResultSets=True'
```

### PowerShell (Process scope)
```powershell
[Environment]::SetEnvironmentVariable('TESTS_USE_SQLSERVER', '1', 'Process')
[Environment]::SetEnvironmentVariable('ConnectionStrings__DefaultConnection', 'Server=localhost,1433;Database=CrepasDB_Test_Base;User Id=sa;Password=YourStrong!Passw0rd;Encrypt=True;TrustServerCertificate=True;MultipleActiveResultSets=True', 'Process')
```

> No uses scope `User` para estas variables: el backend en Visual Studio también hereda variables persistentes y puede arrancar con una conexión de tests.

> La fábrica de integration tests crea un catálogo único por corrida (`CrepasDB_Test_{Guid}`), aplica migraciones y lo elimina al finalizar.

## Limpieza de variables persistentes (si ya se configuraron en User)
```powershell
[Environment]::SetEnvironmentVariable('TESTS_USE_SQLSERVER', $null, 'User')
[Environment]::SetEnvironmentVariable('ConnectionStrings__DefaultConnection', $null, 'User')
```

## Ejecutar tests
Desde la raíz del repo:
```bash
dotnet restore backend/CobranzaDigital.sln
dotnet build backend/CobranzaDigital.sln -c Release --no-restore
dotnet test backend/CobranzaDigital.sln -c Release --no-build
```

## CI (GitHub Actions)
El workflow `.github/workflows/ci.yml` ejecuta los tests backend con SQL Server service container.

Variables requeridas en GitHub Actions (env del job):
- `TESTS_USE_SQLSERVER=1`.
- `ConnectionStrings__DefaultConnection`.
- Credenciales de deploy ya existentes para jobs de despliegue.
