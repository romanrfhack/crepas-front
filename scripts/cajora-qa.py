#!/usr/bin/env python3
"""QA controlado contra API existente. No usa SQL ni guarda tokens de sesión."""
import getpass
import json
import os
from pathlib import Path
import secrets
import sys
import urllib.error
import urllib.request
import uuid

BASE = "https://cobranzadigital.site/api/v1"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class QA:
    def __init__(self):
        os.umask(0o077)
        self.run = uuid.uuid4().hex[:12]
        self.directory = Path.cwd() / ("cajora-qa-" + self.run)
        self.directory.mkdir(mode=0o700)
        self.report = {"run": self.run, "base": BASE, "status": "running",
                       "businesses": [], "checks": [], "requests": []}
        self.opener = urllib.request.build_opener(NoRedirect())
        self.save()

    def save(self):
        target = self.directory / "resultado.json"
        temp = self.directory / "resultado.tmp"
        temp.write_text(json.dumps(self.report, indent=2, ensure_ascii=False))
        temp.replace(target)

    def check(self, name, condition):
        self.report["checks"].append({"name": name, "passed": bool(condition)})
        self.save()
        print(("OK: " if condition else "FALLO: ") + name, flush=True)
        if not condition:
            raise RuntimeError(name)

    def call(self, method, path, token=None, body=None, tenant=None, expected=(200,)):
        headers = {"Accept": "application/json", "Content-Type": "application/json",
                   "X-Correlation-Id": "cajora-qa-" + self.run + "-" + uuid.uuid4().hex[:8]}
        if token:
            headers["Authorization"] = "Bearer " + token
        if tenant:
            headers["X-Tenant-Id"] = tenant
        req = urllib.request.Request(BASE + path, headers=headers, method=method,
                                     data=None if body is None else json.dumps(body).encode())
        try:
            with self.opener.open(req, timeout=30) as response:
                status, raw = response.status, response.read()
        except urllib.error.HTTPError as response:
            status, raw = response.code, response.read()
        self.report["requests"].append({"method": method, "path": path,
                                        "status": status, "correlationId": headers["X-Correlation-Id"]})
        self.save()
        if status not in expected:
            raise RuntimeError(f"{method} {path}: HTTP {status}; esperado {expected}")
        if not raw:
            return None
        try:
            return json.loads(raw)
        except ValueError:
            raise RuntimeError(f"{method} {path}: respuesta no JSON") from None

    def login(self, email, password):
        result = self.call("POST", "/auth/login", body={"email": email, "password": password})
        return result["accessToken"]

    def setup(self, platform, label, password):
        prefix = "QA Cajora " + self.run + " " + label
        record = {"name": prefix}
        self.report["businesses"].append(record)
        vertical = self.call("POST", "/platform/verticals", platform,
                             {"name": prefix, "description": "Exclusivo QA; no usar comercialmente"})
        record["verticalId"] = vertical["id"]
        self.save()
        template = self.call("POST", "/platform/catalog-templates", platform,
                             {"verticalId": vertical["id"], "name": prefix, "version": "qa-1", "isActive": True})
        record["templateId"] = template["id"]
        self.save()
        tenant = self.call("POST", "/platform/tenants", platform,
                           {"verticalId": vertical["id"], "name": prefix,
                            "slug": "qa-cajora-" + self.run + "-" + label.lower(),
                            "timeZoneId": "America/Mexico_City"})
        record.update(tenantId=tenant["id"], storeId=tenant["defaultStoreId"])
        self.save()
        details = self.call("GET", "/platform/tenants/" + record["tenantId"], platform)
        self.check(label + ": catálogo exclusivo asignado", details["catalogTemplateId"] == template["id"])
        users = {}
        for role in ("TenantAdmin", "Cashier"):
            email = f"qa-cajora-{self.run}-{label.lower()}-{role.lower()}@example.com"
            created = self.call("POST", "/admin/users", platform,
                                {"email": email, "userName": email, "role": role,
                                 "tenantId": record["tenantId"], "storeId": record["storeId"],
                                 "temporaryPassword": password}, expected=(201,))
            record.setdefault("users", []).append({"id": created["id"], "email": email, "role": role})
            self.save()
            users[role] = self.login(email, password)
        category = self.call("POST", "/pos/admin/categories", users["TenantAdmin"],
                             {"categoryCode": "QA-" + self.run + "-" + label, "name": prefix, "sortOrder": 1, "isActive": True})
        record["categoryId"] = category["id"]
        self.save()
        product = self.call("POST", "/pos/admin/products", users["TenantAdmin"],
                            {"externalCode": "QA-" + self.run + "-" + label, "name": prefix + " Producto $50",
                             "categoryId": category["id"], "basePrice": 50,
                             "isActive": True, "isAvailable": True, "isInventoryTracked": True})
        record["productId"] = product["id"]
        self.save()
        self.call("POST", "/pos/admin/catalog/inventory/adjustments", users["TenantAdmin"],
                  {"storeId": record["storeId"], "itemType": "Product", "itemId": product["id"],
                   "quantityDelta": 20, "reason": "InitialLoad", "reference": prefix,
                   "clientOperationId": str(uuid.uuid4())})
        return record, users

    def stock(self, business, token):
        rows = self.call("GET", "/pos/reports/inventory/current?storeId=" + business["storeId"], token)
        matches = [row for row in rows if row["itemId"] == business["productId"]]
        if len(matches) != 1:
            raise RuntimeError("Saldo del producto de QA ausente o duplicado")
        return matches[0]["stockOnHandQty"]

    def execute(self):
        print("Se crearán SOLO negocios nuevos QA, con catálogos y usuarios exclusivos.")
        print("Aislamiento lógico en la BD existente. No se borra ningún dato al terminar.")
        print("Las operaciones QA pueden aparecer en los reportes globales del administrador.")
        email = input("Correo de SuperAdmin: ").strip()
        platform = self.login(email, getpass.getpass("Contraseña de SuperAdmin (oculta): "))
        self.call("GET", "/platform/verticals", platform)
        # El listado existe en despliegues que aún no incluyen el formulario /options.
        # Sólo comprobar acceso; no guardar ni mostrar los usuarios devueltos.
        self.call("GET", "/admin/users?page=1&pageSize=1", platform)
        password = "Qa!" + secrets.token_urlsafe(24) + "9aA"
        credentials = self.directory / "credenciales-qa.txt"
        credentials.write_text("Contraseña EXCLUSIVA de los usuarios QA: " + password + "\n"
                               "Correos/roles: consultar resultado.json. No compartir este archivo.\n")
        a, ua = self.setup(platform, "A", password)
        b, ub = self.setup(platform, "B", password)
        self.check("Inventario inicial A = 20", self.stock(a, ua["TenantAdmin"]) == 20)
        self.check("Inventario inicial B = 20", self.stock(b, ub["TenantAdmin"]) == 20)
        for own, users, other in ((a, ua, b), (b, ub, a)):
            self.call("GET", "/pos/catalog/snapshot?storeId=" + own["storeId"], users["TenantAdmin"])
            self.call("GET", "/pos/catalog/snapshot?storeId=" + other["storeId"], users["TenantAdmin"], expected=(403, 404))
            self.call("POST", "/pos/admin/catalog/inventory/adjustments", users["TenantAdmin"],
                      {"storeId": other["storeId"], "itemType": "Product", "itemId": other["productId"],
                       "quantityDelta": 1, "reason": "Correction", "clientOperationId": str(uuid.uuid4())}, expected=(403, 404))
        self.check("Lectura y escritura cruzadas denegadas A/B", True)
        self.call("GET", "/admin/users?page=1&pageSize=1", ua["Cashier"], expected=(403,))
        self.check("Cajero sin administración de usuarios", True)
        self.call("GET", "/pos/shifts/current?storeId=" + a["storeId"], ua["Cashier"], expected=(204,))
        shift = self.call("POST", "/pos/shifts/open", ua["Cashier"],
                          {"openingCashAmount": 100, "storeId": a["storeId"],
                           "clientOperationId": str(uuid.uuid4()), "notes": "QA Cajora " + self.run})
        a["shiftId"] = shift["id"]
        self.save()
        def payload(payments):
            return {"clientSaleId": str(uuid.uuid4()), "storeId": a["storeId"],
                    "items": [{"productId": a["productId"], "quantity": 1, "selections": [], "extras": []}],
                    "payments": payments}
        for method in ("Card", "Transfer"):
            self.call("POST", "/pos/sales", ua["Cashier"], payload([{"method": method, "amount": 50}]), expected=(400,))
        self.check("Tarjeta/transferencia sin referencia rechazadas", True)
        self.check("Rechazos no consumen stock", self.stock(a, ua["TenantAdmin"]) == 20)
        sales = []
        batches = [[{"method": "Cash", "amount": 50}],
                   [{"method": "Card", "amount": 50, "reference": "QA-card"}],
                   [{"method": "Transfer", "amount": 50, "reference": "QA-transfer"}],
                   [{"method": "Cash", "amount": 20}, {"method": "Card", "amount": 30, "reference": "QA-mixed"}]]
        for payments in batches:
            request = payload(payments)
            sale = self.call("POST", "/pos/sales", ua["Cashier"], request)
            a.setdefault("saleIds", []).append(sale["saleId"])
            self.save()
            self.check("Venta total $50", sale["total"] == 50)
            detail = self.call("GET", "/pos/sales/" + sale["saleId"], ua["Cashier"])
            self.check("Pagos guardados con importes y referencias correctos",
                       len(detail["payments"]) == len(payments)
                       and sorted((p["amount"], p.get("reference") or "") for p in detail["payments"])
                       == sorted((p["amount"], p.get("reference") or "") for p in payments))
            replay = self.call("POST", "/pos/sales", ua["Cashier"], request)
            self.check("Venta repetida conserva ID", replay["saleId"] == sale["saleId"])
            sales.append(sale)
        self.check("Cuatro ventas: stock A = 16", self.stock(a, ua["TenantAdmin"]) == 16)
        self.call("GET", "/pos/sales/" + sales[0]["saleId"], ub["TenantAdmin"], expected=(403, 404))
        self.check("Venta de A inaccesible para B", True)
        query = "?storeId=" + a["storeId"] + "&shiftId=" + shift["id"]
        preview = self.call("GET", "/pos/shifts/close-preview" + query, ua["Cashier"])
        self.check("Antes de anular: efectivo esperado $170", preview["expectedCashAmount"] == 170)
        void = {"reasonCode": "CashierError", "reasonText": "Prueba QA", "note": self.run,
                "clientVoidId": str(uuid.uuid4())}
        self.call("POST", "/pos/sales/" + sales[0]["saleId"] + "/void", ua["Cashier"], void)
        self.call("POST", "/pos/sales/" + sales[0]["saleId"] + "/void", ua["Cashier"], void)
        self.check("Anulación y replay: stock A = 17", self.stock(a, ua["TenantAdmin"]) == 17)
        preview = self.call("GET", "/pos/shifts/close-preview" + query, ua["Cashier"])
        self.check("Tras anular: efectivo esperado $120", preview["expectedCashAmount"] == 120)
        breakdown = preview["breakdown"]
        self.check("Desglose: efectivo 20, tarjeta 80, transferencia 50, tres ventas",
                   breakdown["cashAmount"] == 20 and breakdown["cardAmount"] == 80
                   and breakdown["transferAmount"] == 50 and breakdown["totalSalesCount"] == 3)
        close_request = {"shiftId": shift["id"], "storeId": a["storeId"],
                         "countedDenominations": [{"denominationValue": 100, "count": 1},
                                                  {"denominationValue": 20, "count": 1}],
                         "closingNotes": "QA Cajora " + self.run, "closeReason": "QA",
                         "clientOperationId": str(uuid.uuid4())}
        closed = self.call("POST", "/pos/shifts/close", ua["Cashier"], close_request)
        self.check("Cierre: esperado/contado $120, diferencia $0",
                   closed["expectedCashAmount"] == 120 and closed["countedCashAmount"] == 120
                   and closed["difference"] == 0)
        self.call("GET", "/pos/shifts/current?storeId=" + a["storeId"], ua["Cashier"], expected=(204,))
        # Nueva sesión: comprueba persistencia sin reutilizar el access token anterior.
        cashier_email = next(u["email"] for u in a["users"] if u["role"] == "Cashier")
        fresh = self.login(cashier_email, password)
        detail = self.call("GET", "/pos/sales/" + sales[1]["saleId"], fresh)
        self.check("Venta y pagos persisten tras nuevo login", detail["total"] == 50 and len(detail["payments"]) == 1)
        self.call("GET", "/pos/shifts/current?storeId=" + a["storeId"], fresh, expected=(204,))
        self.check("Cierre persiste tras nuevo login", True)
        self.check("Negocio B conserva stock 20", self.stock(b, ub["TenantAdmin"]) == 20)
        self.report["status"] = "passed"
        self.save()
        print("QA API APROBADO. Falta QA de navegador, backups, impresión y release.")


if __name__ == "__main__":
    qa = QA()
    try:
        qa.execute()
    except (Exception, KeyboardInterrupt) as error:
        qa.report["status"] = "failed"
        qa.report["error"] = str(error) if isinstance(error, RuntimeError) else type(error).__name__
        qa.save()
        print("DETENIDO: " + qa.report["error"])
        print("No repetir automáticamente: pueden existir altas o un turno QA abierto.")
        sys.exit(1)
    finally:
        print("Evidencia sin contraseñas/tokens: " + str(qa.directory / "resultado.json"))
        print("Credenciales QA privadas: " + str(qa.directory / "credenciales-qa.txt"))
