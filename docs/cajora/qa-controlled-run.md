# QA controlado de Cajora

Estado: preparado; pendiente de ejecución contra la API desplegada y revisión visual.

## Ejecución

Ejecutar `python3 scripts/cajora-qa.py` en un directorio privado del VPS con acceso HTTPS a `cobranzadigital.site`. Requiere una cuenta SuperAdmin existente. La contraseña se solicita de forma oculta, no como argumento ni variable de entorno. No compartirla en chat.

El script verifica acceso a administración antes de crear datos. Crea dos empresas con prefijo `QA Cajora <run>`, giros, catálogos, sucursales matriz y usuarios TenantAdmin/Cashier exclusivos. No edita empresas comerciales, no usa SQL directo y no cambia la configuración del servicio.

El aislamiento es lógico dentro de la base de datos existente. Las operaciones de QA pueden aparecer en reportes globales de plataforma; esta prueba no equivale a un ambiente staging. Se mantienen los datos para auditoría. Los pagos de tarjeta y transferencia son registros simulados, sin cobros bancarios.

## Resultados esperados

| Paso | Resultado |
| --- | --- |
| Inventario inicial | A: 20 unidades; B: 20 unidades |
| Acceso cruzado A/B | Catálogo y ajustes de otra sucursal denegados |
| Permisos de cajero | Administración de usuarios denegada |
| Apertura | Fondo inicial de $100 |
| Pagos incompletos | Tarjeta/transferencia sin referencia rechazadas, stock sin cambios |
| Cuatro ventas de $50 | Efectivo $50; tarjeta $50; transferencia $50; mixto $20 efectivo/$30 tarjeta |
| Persistencia e idempotencia | Importes/referencias guardados; reenviar venta conserva ID |
| Inventario después de ventas | A: 16 unidades |
| Caja antes de anulación | Efectivo esperado $170 |
| Anulación de venta en efectivo | A: 17 unidades; repetir anulación no devuelve otra unidad |
| Desglose después de anulación | 3 ventas: efectivo $20, tarjeta $80, transferencia $50 |
| Cierre | Fondo $100 + efectivo $20 = $120; contado $120; diferencia $0 |
| Nueva sesión | Venta/pago disponibles, ningún turno abierto |
| Negocio B | Conserva 20 unidades; no puede leer venta de A |

## Evidencia y fallos

En el directorio de ejecución se crea `cajora-qa-<run>/resultado.json` con IDs, correos QA, comprobaciones y estados HTTP/correlación. No contiene contraseñas ni tokens. `credenciales-qa.txt` contiene únicamente la contraseña generada de los usuarios QA. Ambos archivos y su directorio se crean con permisos privados.

Ante un fallo el script se detiene y guarda lo completado. No ejecutarlo de nuevo automáticamente: puede haber altas parciales, ventas o un turno QA abierto. Revisar la evidencia y resolver el caso identificado antes de continuar. No elimina ni revierte operaciones automáticamente.

Una ejecución `passed` acredita sólo las comprobaciones API enumeradas. Pendiente en navegador: acceso desde la landing, sesión de cajero QA, visualización de stock/ventas/anulación/cierre y comprobante; realizar un turno visual adicional separado sin mezclar sus resultados con este escenario. También siguen pendientes las pruebas de dispositivos, impresión y restauración de respaldo para el lanzamiento.

## Preflight reportado el 6 de octubre de 2026

Evidencia compartida desde VPS: login válido con claim SuperAdmin; `/platform/verticals` responde 200 tanto por HTTPS público como por `127.0.0.1:5005`; `/admin/users/options` responde 404 en ambas rutas. `appsettings.json` declara `Features:UserAdmin=true`, sin override `Features__UserAdmin` observado en el proceso; la DLL contiene `AdminUsersController`. Falta identificar por qué `/options` está inaccesible: estos datos no prueban la configuración efectiva ni la versión de API cargada.

El script comprueba ahora acceso mediante `GET /admin/users?page=1&pageSize=1`, sin guardar ni mostrar los usuarios devueltos. Es una consulta previa de autorización independiente del endpoint auxiliar del formulario. Si falla, se detiene antes de crear negocios; no se cambian flags, roles o configuración de API. Las ejecuciones QA reportadas hasta este corte se detuvieron en consultas previas y no crearon negocios, usuarios QA ni turnos. Sigue pendiente el escenario completo.
