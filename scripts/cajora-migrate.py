#!/usr/bin/env python3
"""Preflight por defecto; --apply respalda/verifica y ejecuta el migrador oficial."""
import argparse
from datetime import datetime, timezone
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import uuid

SPEC = importlib.util.spec_from_file_location("audit", Path(__file__).with_name("cajora-db-audit.py"))
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)


def literal(value):
    return "N'" + value.replace("'", "''") + "'"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--release-dir", type=Path)
    parser.add_argument("--expected-sha")
    args = parser.parse_args()
    context = AUDIT.connection_context()
    if context["database"] != "CrepasDB":
        raise RuntimeError("BD distinta de CrepasDB; detenido sin cambios")
    print("Destino:", context["server"], context["database"], flush=True)
    release = args.release_dir.resolve() if args.release_dir else context["cwd"]
    if args.release_dir:
        if not args.expected_sha:
            raise RuntimeError("El migrador separado requiere --expected-sha")
        manifest = json.loads((release / "migration-manifest.json").read_text())
        if manifest.get("kind") != "qa-migration-runner" or manifest.get("headSha") != args.expected_sha:
            raise RuntimeError("Manifest del migrador no coincide con SHA esperado")
        print("Migrador separado:", release, "SHA:", args.expected_sha, flush=True)
    api = release / "CobranzaDigital.Api.dll"
    infrastructure = release / "CobranzaDigital.Infrastructure.dll"
    def contains(path, value):
        raw = path.read_bytes()
        return value.encode() in raw or value.encode("utf-16-le") in raw
    if not contains(api, "--migrate-only"):
        raise RuntimeError("DLL no contiene --migrate-only; requiere revisar release")
    expected = (
        "20260312093000_InventoryV2PerformanceGuardrails",
        "20260312120000_InventoryBatchOperation",
        "20260314120000_CatalogPhase1ImportV2",
        "20260318120000_Ventas2SalesIndexes",
        "20260514153113_F7PendingModelDrift",
    )
    for migration in expected:
        if not contains(infrastructure, migration):
            raise RuntimeError("DLL no contiene " + migration + "; requiere revisar release")
    preflight = """
SET NOCOUNT ON;
IF DB_NAME() <> N'CrepasDB' THROW 51000, 'BD incorrecta', 1;
IF OBJECT_ID(N'dbo.__EFMigrationsHistory') IS NULL THROW 51000, 'Sin historial EF', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.__EFMigrationsHistory WHERE MigrationId=N'20260311045906_InventoryV2WritePath')
    THROW 51000, 'Falta baseline InventoryV2WritePath', 1;
IF COL_LENGTH(N'dbo.Categories',N'CategoryCode') IS NULL
BEGIN
    IF EXISTS (SELECT 1 FROM dbo.Categories
               WHERE LEN(LOWER(REPLACE(REPLACE(Name,' ','-'),'--','-'))) > 100)
        THROW 51000, 'CategoryCode generado excede 100 caracteres; revisar datos', 1;
    IF EXISTS (SELECT 1 FROM dbo.Categories WHERE CatalogTemplateId IS NOT NULL
               GROUP BY CatalogTemplateId,LOWER(REPLACE(REPLACE(Name,' ','-'),'--','-')) HAVING COUNT(*)>1)
        THROW 51000, 'Colisiones CategoryCode; revisar datos', 1;
END;
IF EXISTS (SELECT 1 FROM dbo.Sales WHERE ClientSaleId IS NOT NULL
           GROUP BY TenantId,StoreId,ClientSaleId HAVING COUNT(*)>1)
    THROW 51000, 'Ventas con ClientSaleId duplicado', 1;
IF EXISTS (SELECT 1 FROM dbo.Sales GROUP BY TenantId,StoreId,Folio HAVING COUNT(*)>1)
    THROW 51000, 'Ventas con folio duplicado', 1;
SELECT MigrationId FROM dbo.__EFMigrationsHistory ORDER BY MigrationId;
"""
    AUDIT.run_sql(context, preflight)
    print("Preflight de datos y marcadores de DLL: OK", flush=True)
    if not args.apply:
        print("Sólo lectura. --apply crea respaldo COPY_ONLY, VERIFYONLY y ejecuta migraciones.")
        return
    backup_dir = AUDIT.run_sql(context,
        "SET NOCOUNT ON; SELECT CONVERT(nvarchar(4000),SERVERPROPERTY('InstanceDefaultBackupPath'));",
        capture=True).strip()
    if not backup_dir.startswith("/") or "\n" in backup_dir:
        raise RuntimeError("No se pudo identificar directorio de respaldo SQL en Linux")
    backup_name = "CrepasDB-cajora-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:8] + ".bak"
    backup_path = backup_dir.rstrip("/") + "/" + backup_name
    print("Respaldo en servidor SQL:", backup_path, flush=True)
    AUDIT.run_sql(context,
        "BACKUP DATABASE [CrepasDB] TO DISK=" + literal(backup_path) +
        " WITH COPY_ONLY,CHECKSUM,COMPRESSION; RESTORE VERIFYONLY FROM DISK=" +
        literal(backup_path) + " WITH CHECKSUM;", timeout=1800)
    print("Respaldo y VERIFYONLY: OK. Ejecutando migrador oficial.", flush=True)
    process_env = dict(os.environ)
    process_env.update(context["processenv"])
    name = str(context["settings"].get("databaseoptions__connectionstringname", "DefaultConnection"))
    keys = ("databaseoptions__connectionstringname", "connectionstrings__" + name.lower())
    process_env = {key: value for key, value in process_env.items() if key.lower() not in keys}
    process_env["DatabaseOptions__ConnectionStringName"] = name
    process_env["ConnectionStrings__" + name] = context["settings"]["connectionstrings__" + name.lower()]
    result = subprocess.run(["dotnet", str(api), "--migrate-only"],
                            cwd=release, env=process_env, timeout=1800)
    if result.returncode:
        raise RuntimeError("Migrador falló. Respaldo: " + backup_path + "; no repetir ni restaurar automáticamente")
    assertions = "SET NOCOUNT ON; IF COL_LENGTH(N'dbo.Categories',N'CategoryCode') IS NULL THROW 51000,'CategoryCode sigue ausente',1; "
    for migration in expected:
        assertions += "IF NOT EXISTS(SELECT 1 FROM dbo.__EFMigrationsHistory WHERE MigrationId=" + literal(migration) + ") THROW 51000,'Migracion esperada ausente',1; "
    assertions += "SELECT MigrationId FROM dbo.__EFMigrationsHistory ORDER BY MigrationId;"
    AUDIT.run_sql(context, assertions)
    print("Migraciones y columna verificadas. No se reinició la API ni se repitió el alta QA.")
    print("VERIFYONLY no sustituye una prueba de restauración completa. Respaldo:", backup_path)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("DETENIDO:", str(error) if isinstance(error, RuntimeError) else type(error).__name__)
        raise SystemExit(1)
