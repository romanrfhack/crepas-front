# Documentación BACK

## EF Core: comandos útiles

Los comandos asumen que el `DbContext` vive en `CobranzaDigital.Infrastructure` y que el proyecto de inicio es la API. Ajusta el nombre de la migración según corresponda.

```bash
# Agregar migración
dotnet ef migrations add <NombreMigracion> \
  --project src/CobranzaDigital.Infrastructure \
  --startup-project src/CobranzaDigital.Api \
  --output-dir Migrations

# Listar migraciones
dotnet ef migrations list \
  --project src/CobranzaDigital.Infrastructure \
  --startup-project src/CobranzaDigital.Api

# Aplicar migraciones (update)
dotnet ef database update \
  --project src/CobranzaDigital.Infrastructure \
  --startup-project src/CobranzaDigital.Api
```

Si `dotnet ef` no está disponible, instala la herramienta:

```bash
dotnet tool install --global dotnet-ef
```

## Bootstrap de ambiente desde cero (BD limpia)

1. **Configura la conexión a la base de datos.**
   - Edita `src/CobranzaDigital.Api/appsettings.json` o usa variables de entorno/secretos para definir `ConnectionStrings:SqlServer` y el `DatabaseOptions:ConnectionStringName`.【F:src/CobranzaDigital.Api/appsettings.json†L1-L29】

2. **(Opcional) Elimina la base de datos existente para arrancar limpia.**
   ```bash
   dotnet ef database drop --force \
     --project src/CobranzaDigital.Infrastructure \
     --startup-project src/CobranzaDigital.Api
   ```

3. **Aplica migraciones para crear el esquema desde cero.**
   ```bash
   dotnet ef database update \
     --project src/CobranzaDigital.Infrastructure \
     --startup-project src/CobranzaDigital.Api
   ```

4. **Levanta la API.**
   ```bash
   dotnet run --project src/CobranzaDigital.Api
   ```

## Seed mínimo (admin/roles) — opcional

En **Development**, la API ejecuta un seed de identidad al iniciar, que crea los roles `Admin`, `Manager` y `Collector`.【F:src/CobranzaDigital.Api/Program.cs†L131-L155】【F:src/CobranzaDigital.Infrastructure/Identity/IdentitySeeder.cs†L10-L71】

Para crear el usuario admin automáticamente:

1. Define en configuración los valores `IdentitySeed:AdminEmail` y `IdentitySeed:AdminPassword`.
   - Ejemplo en `appsettings.Development.json`:
     ```json
     {
       "IdentitySeed": {
         "AdminEmail": "admin@local",
         "AdminPassword": "P@ssw0rd!"
       }
     }
     ```
2. Arranca la API en `Development` y el usuario se crea/asigna al rol `Admin`.【F:src/CobranzaDigital.Infrastructure/Identity/IdentitySeeder.cs†L29-L71】

> Si faltan `AdminEmail` o `AdminPassword`, el seed del admin se omite y solo se crean los roles por defecto.【F:src/CobranzaDigital.Infrastructure/Identity/IdentitySeeder.cs†L10-L54】
