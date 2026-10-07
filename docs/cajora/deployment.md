# Publicación de cajora.leroa.com.mx

Estado: preparación; no aplicada. Reutiliza el backend existente solo después de aprobar aislamiento y operación.

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
