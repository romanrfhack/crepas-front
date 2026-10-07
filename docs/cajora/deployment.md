# Publicación de cajora.leroa.com.mx

## Estado confirmado — 2026-10-06, America/Mexico_City

Landing publicada por Román desde el commit ff22a1fbf9e634ca033c75a81e0236b41e58b39c. Evidencia aportada: salida de Certbot, curl y capturas de navegador. No equivale a despliegue del frontend Angular completo ni a validación funcional autenticada.

- DNS A: cajora.leroa.com.mx → 194.238.26.70; consultas a 1.1.1.1 y 8.8.8.8 confirmadas.
- Landing: /var/www/cajora/landing-releases/ff22a1fbf9e634ca033c75a81e0236b41e58b39c.
- Archivos descargados: frontend/public/cajora/index.html y styles.css del commit indicado.
- Nginx: /etc/nginx/sites-available/cajora, habilitado por enlace en sites-enabled.
- HTTPS emitido por Certbot; certificado vence 2027-01-05, renovación automática configurada según su salida.
- Raíz HTTPS: HTTP/2 200, text/html, 9105 bytes.
- /cajora/styles.css: HTTP/2 200, text/css, 6861 bytes.
- /login: redirección temporal 302 a https://cobranzadigital.site/login; comprobada por Román en navegador.
- Landing mantiene mensaje de preparación y noindex. No se habilitan nuevos negocios todavía.
- No se actualizaron API, BD ni aplicación Angular de CobranzaDigital. Frontend existente: c7caa8d, r344.

Configuración inicial aplicada: landing estática en raíz, /login redirigido al dominio existente y restantes archivos mediante try_files $uri =404. Certbot agregó HTTPS/redirección HTTP. La plantilla ops/nginx/cajora-http.conf es para la siguiente fase con Angular completo; NO representa todavía la configuración aplicada.

## Próxima fase

1. Reconciliar versión API desplegada y disponibilidad de backup/restore.
2. Preparar entorno/tenant de prueba aislado para operación, evitando ventas ficticias sobre datos comerciales.
3. Validar login por rol, venta/pagos/referencias, idempotencia, anulación, inventario y cierre; probar aislamiento entre clientes.
4. Publicar frontend Angular desde artefacto aprobado por CI y habilitar /api, /app y deep links en el nuevo hostname.
5. Sustituir la redirección temporal /login, comprobar sesión por origen, health y smoke autenticado.
6. Abrir altas asistidas únicamente tras cerrar puertas de lanzamiento.

## Runbook previsto para aplicación completa

Estado de esta fase: preparación; no aplicada. Reutiliza el backend existente solo después de aprobar aislamiento y operación.

## DNS y TLS

Crear registro A `cajora` en la zona `leroa.com.mx` al VPS `194.238.26.70`; comprobar que la IP sigue siendo la del servidor objetivo. Revisar registros AAAA antes de emitir TLS. Usar DNS-only durante bootstrap de certificado; no cambiar otros registros.

## Artefacto y hostname

1. Obtener el artefacto WEB del SHA aprobado, construido por CI. Conservar release anterior y no recompilar en VPS.
2. Extraer a `/var/www/cajora/releases/<releaseId>` y preparar symlink `/var/www/cajora/web` al release validado. No cambiar `/var/www/cobranzadigital/web` ni sus datos.
3. Copiar `ops/nginx/cajora-http.conf` a un sitio Nginx nuevo; verificar puerto API `127.0.0.1:5005`, permisos de lectura y docroot.
4. Ejecutar `nginx -t` antes de habilitar/reload. Emitir certificado con `certbot --nginx -d cajora.leroa.com.mx --redirect`; revisar configuración resultante y renovación. HSTS se incorpora únicamente con HTTPS verificado.
5. Validar `/` (landing), `/login`, deep link `/app/pos/caja` y estáticos. El deep link sin sesión debe redirigir al login.
6. Validar `/health/live` y `/health/ready`: HTTP 200 + Content-Type texto + Healthy. No aceptar 200 de SPA como health.
7. Consultar `/assets/build-info.json`; confirmar SHA esperado y smoke autenticado con usuario/tenant/store de prueba sin mutaciones en producción.
8. Comprobar acceso en ambos dominios. localStorage es por origen: el usuario inicia sesión de nuevo en Cajora. No copiar tokens entre dominios.

No cambiar issuer/audience de JWT, servicios, base de datos, rutas `/api/v1` ni nombres técnicos para el rebranding. Revisar host/proxy/cookies si aparece dependencia de dominio.

## Lanzamiento

La landing permanece noindex y anuncia preparación mientras falten gates. Tras validar, actualizar mensaje de disponibilidad y habilitar solo negocios aceptados por alta asistida. No activar registro masivo por retirar noindex.

Si falla el nuevo hostname, deshabilitar únicamente su sitio Nginx o volver a su symlink anterior. Rollback de binario no revierte migraciones ni datos. Este incremento no contiene migraciones.

## Accesos pendientes

El entorno de preparación no alcanza SSH al VPS; no se dispone de una sesión DNS Cloudflare operable. DNS, certificado, instalación Nginx, restauración de backup y smoke autenticado del host quedan pendientes con sus evidencias. Estos accesos no impiden revisar ni validar el frontend y el PR.
