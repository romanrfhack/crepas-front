#!/usr/bin/env python3
"""Consulta de esquema SQL Server; no DDL/DML y sin imprimir credenciales."""
import json
import os
from pathlib import Path
import shutil
import subprocess


def pairs(value):
    result = {}
    index = 0
    while index < len(value):
        while index < len(value) and value[index] in " ;\t\r\n":
            index += 1
        if index == len(value):
            break
        end = value.find("=", index)
        if end < 0:
            raise RuntimeError("Cadena de conexión no interpretable")
        key = value[index:end].strip().lower()
        index = end + 1
        while index < len(value) and value[index].isspace():
            index += 1
        if index < len(value) and value[index] in "\"'":
            quote = value[index]
            index += 1
            output = []
            while index < len(value):
                char = value[index]
                index += 1
                if char == quote:
                    if index < len(value) and value[index] == quote:
                        output.append(quote)
                        index += 1
                    else:
                        break
                else:
                    output.append(char)
            item = "".join(output)
            while index < len(value) and value[index].isspace():
                index += 1
            if index < len(value) and value[index] != ";":
                raise RuntimeError("Cadena de conexión no interpretable")
        else:
            end = value.find(";", index)
            if end < 0:
                end = len(value)
            item = value[index:end].strip()
            index = end
        result[key] = item
    return result


def connection_context():
    pid = subprocess.check_output(["systemctl", "show", "cobranzadigital-api",
                                   "-p", "MainPID", "--value"], text=True).strip()
    if not pid.isdigit() or pid == "0":
        raise RuntimeError("API sin proceso activo")
    proc = Path("/proc") / pid
    cwd = (proc / "cwd").resolve()
    env = {}
    for raw in (proc / "environ").read_bytes().split(b"\0"):
        key, sep, value = raw.partition(b"=")
        if sep:
            env[key.decode().lower()] = value.decode()
    environment = env.get("dotnet_environment", env.get("aspnetcore_environment", "Production"))
    settings = {}
    def flatten(data, prefix=""):
        for key, value in data.items():
            full = prefix + key.lower()
            if isinstance(value, dict):
                flatten(value, full + "__")
            else:
                settings[full] = value
    for name in ("appsettings.json", f"appsettings.{environment}.json"):
        path = cwd / name
        if path.exists():
            flatten(json.loads(path.read_text(encoding="utf-8-sig")))
    settings.update(env)
    # ASP.NET Core command-line settings have precedence over environment settings.
    args = [a.decode() for a in (proc / "cmdline").read_bytes().split(b"\0") if a]
    for index, arg in enumerate(args):
        if arg.startswith("--"):
            key, sep, value = arg[2:].partition("=")
            if not sep and index + 1 < len(args) and not args[index + 1].startswith("--"):
                value = args[index + 1]
                sep = "="
            if sep:
                settings[key.lower().replace(":", "__")] = value
    name = str(settings.get("databaseoptions__connectionstringname", "DefaultConnection"))
    connection = settings.get("connectionstrings__" + name.lower())
    if not isinstance(connection, str):
        raise RuntimeError("No se encontró la conexión; no se muestra configuración sensible")
    values = pairs(connection)
    server = values.get("server") or values.get("data source")
    database = values.get("database") or values.get("initial catalog")
    user = values.get("user id") or values.get("uid") or values.get("user")
    password = values.get("password") or values.get("pwd")
    if not all((server, database, user, password)):
        raise RuntimeError("Se requiere conexión SQL autenticada con servidor y BD explícitos")
    executable = shutil.which("sqlcmd")
    if not executable:
        executable = next((p for p in ("/opt/mssql-tools18/bin/sqlcmd", "/opt/mssql-tools/bin/sqlcmd")
                           if Path(p).is_file()), None)
    if not executable:
        raise RuntimeError("sqlcmd no instalado; no se instalará automáticamente")
    command_env = dict(os.environ)
    command_env["SQLCMDPASSWORD"] = password
    process_env = {}
    for raw in (proc / "environ").read_bytes().split(b"\0"):
        key, sep, value = raw.partition(b"=")
        if sep:
            process_env[key.decode()] = value.decode()
    return {"server": server, "database": database, "user": user,
            "sqlcmd": executable, "sqlenv": command_env,
            "cwd": cwd, "processenv": process_env, "settings": settings}


def run_sql(context, sql, capture=False, timeout=90):
    result = subprocess.run([context["sqlcmd"], "-S", context["server"],
                             "-d", context["database"], "-U", context["user"],
                             "-C", "-b", "-l", "15", "-t", str(timeout),
                             "-w", "200", "-h", "-1", "-W", "-Q", sql],
                            env=context["sqlenv"], timeout=timeout + 30,
                            capture_output=capture, text=True)
    if result.returncode:
        if capture:
            print(result.stdout, result.stderr)
        raise RuntimeError("Consulta SQL falló; revisar salida")
    return result.stdout if capture else None


def main():
    context = connection_context()
    print("Servidor:", context["server"], "BD:", context["database"], flush=True)
    sql = """
SET NOCOUNT ON;
SELECT DB_NAME() AS DatabaseName;
SELECT s.name AS SchemaName, t.name AS TableName, c.name AS ColumnName,
       ty.name AS SqlType, c.max_length AS MaxLengthBytes, c.is_nullable AS IsNullable
FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id
JOIN sys.columns c ON c.object_id=t.object_id
JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE t.name IN ('Categories','Products','CatalogImportBatchOperations')
ORDER BY s.name,t.name,c.column_id;
IF OBJECT_ID(N'dbo.__EFMigrationsHistory') IS NOT NULL
    SELECT MigrationId, ProductVersion FROM dbo.__EFMigrationsHistory ORDER BY MigrationId;
ELSE SELECT N'No existe dbo.__EFMigrationsHistory' AS Finding;
SELECT s.name AS SchemaName,t.name AS TableName,i.name AS IndexName,i.is_unique,
       i.filter_definition
FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id
JOIN sys.indexes i ON i.object_id=t.object_id
WHERE t.name='Categories' ORDER BY s.name,i.name;
"""
    run_sql(context, sql)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("DETENIDO:", str(error) if isinstance(error, RuntimeError) else type(error).__name__)
        raise SystemExit(1)
