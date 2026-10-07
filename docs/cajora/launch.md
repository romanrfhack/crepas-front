# Cajora: básico gratis y lanzamiento controlado

Decisión autorizada por Román: 2026-10-06 (America/Mexico_City).
Marca comercial: **Cajora**, producto de Leroa. Dominio previsto: **cajora.leroa.com.mx**.
El dominio no está publicado por este incremento. Nombre aceptado para trabajar; sin afirmar registro marcario.

## Modelo aprobado

- Básico gratis, sin expiración promocional. No requiere suscripción para conservar sus funciones.
- Lanzamiento con pocos negocios y alta asistida; sin registro público automático.
- Por cliente: una empresa, una sucursal y una caja. Límites administrados durante onboarding; este cambio no introduce cuotas ni billing en backend.
- Funciones del básico: catálogo y personalizaciones existentes, ventas, registro de pagos, historial/anulación, turnos/arqueo, inventario y reportes básicos que superen validación.
- Suscripciones futuras opcionales para funciones adicionales. No retirar al básico funciones ya incluidas.
- Seguridad, aislamiento, respaldos y correcciones de errores forman parte de la operación de ambos planes.
- Sin prometer offline, CFDI, procesamiento de tarjetas, hardware, lealtad ni inventario V2 en este lanzamiento.
- Usuarios operativos según permisos existentes; no se inventa un límite de usuarios o ventas no acordado.
- Soporte inicial por guías y alta asistida. Definir capacidad real de soporte antes de incorporar clientes.

## Entrega de este incremento

- Identidad visible Cajora en login, encabezado y título; se conservan nombres internos .NET/Angular, JWT, rutas, datos y contratos.
- Landing estática en `frontend/public/cajora/`; Angular la copia al artefacto web.
- Raíz existente de CobranzaDigital conserva su redirección al login. Nginx del nuevo hostname sirve la landing en `/` y la aplicación en `/login` y `/app/*`.
- CTA al canal existente `https://romanromero.dev/#contacto`. No se almacena una solicitud ni se simula cuenta activada; se pide indicar Cajora y el giro. El aviso enlazado corresponde a ese canal.
- Landing informa preparación/alta asistida y mantiene noindex hasta QA y apertura controlada.
- CI ahora valida PR hacia main con backend SQL Server + frontend aunque el diff no toque backend. Artefactos de release y manifiesto se generan únicamente desde main. Deploy mantiene su filtro de main.
- Plantilla Nginx en `ops/nginx/cajora-http.conf`, sin ejecutarse en VPS.

## Puertas antes de activar negocios

| Puerta       | Evidencia requerida                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------- |
| Código       | CI del PR verde, build, unit tests y UI-contract                                                                 |
| Datos        | Integraciones contra SQL Server: venta, referencias de pago, idempotencia, anulación, inventario y cierre        |
| Aislamiento  | Dos tenants y stores distintos; lectura/escritura cruzada denegada, roles sin privilegios de plataforma          |
| Release      | SHA API y web reconciliados, smoke autenticado y comprobaciones health con texto Healthy, nunca HTML             |
| Recuperación | Backup y restauración en entorno de prueba verificadas                                                           |
| Dispositivos | Venta/cierre en equipos objetivo; impresión comprobada antes de ofrecerla                                        |
| Onboarding   | Crear un negocio limpio con cuenta propia y catálogo aislado; no compartir SuperAdmin ni datos reales en la demo |
| Acceso       | Revisar recuperación de cuenta, expiración y revocación de sesiones                                              |
| Publicación  | DNS, HTTPS, Nginx y deep links comprobados; contacto accesible                                                   |

La arquitectura contiene multi-tenant, pero `docs/release-config.md` mantiene Ruta A limitada. No interpretar que varios clientes simultáneos quedan habilitados comercialmente por cambiar marca. Primero aprobar pruebas de aislamiento y operación con dos clientes; actualizar el contrato de release con evidencia en el siguiente incremento.

## Validación manual de caja (entorno aislado)

1. Alta de tenant/sucursal/catalog template propios y usuarios TenantAdmin/Cashier.
2. Abrir con $100; vender producto de $50 en efectivo. Total esperado $150.
3. Reenviar la misma operación y comprobar una sola venta y un solo consumo de inventario.
4. Registrar tarjeta y transferencia con referencia; comprobar que no aumentan efectivo esperado.
5. Anular una venta y comprobar reportes, efectivo esperado e inventario según las reglas actuales.
6. Intentar acciones de otro tenant/store; deben fallar sin exponer datos.
7. Cerrar con contado conocido; revisar diferencia, motivo y consistencia del reporte.
8. Refrescar/reiniciar sesión; historial y cierre deben persistir.

No ejecutar ventas de prueba sobre datos comerciales existentes.

## Pendientes siguientes

1. Completar gates de backend/host y registrar resultados en `validation.md`.
2. Activar DNS/HTTPS del hostname sin sustituir dominios existentes.
3. Preparar empresa demo con datos ficticios y grabar venta/cierre/reportes.
4. Reclutar una primera tanda pequeña, registrar solicitudes/altas/incidencias y medir primera venta/primer cierre.
5. Decidir planes premium con evidencia de uso y costo operativo. No implementar cobros en este incremento.
