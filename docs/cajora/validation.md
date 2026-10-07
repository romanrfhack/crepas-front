# Evidencia de preparación Cajora

Fecha: 2026-10-06 (America/Mexico_City). Base: main `c7caa8d26ba2d1cd5935fcaeaa559156ea6e263c`.
Estado: frontend validado localmente; lanzamiento pendiente de backend y host.

## Resultados locales

| Validación               | Resultado                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| Build Angular production | Correcto; warning preexistente de presupuesto CSS de pos-caja (9.40 kB frente a 8 kB warning) |
| Unit tests frontend      | 54 archivos, 273 pruebas aprobadas                                                            |
| Playwright UI-contract   | 43 pruebas aprobadas, incluidas 2 de landing/login y navegación móvil                         |
| AXE landing              | Sin violaciones detectadas de wcag2a/wcag2aa/wcag21aa en anchos 1440, 768, 390 y 320          |
| Responsive landing       | Sin overflow horizontal en esos cuatro anchos; captura desktop revisada                       |
| Formato y diff           | Prettier sobre archivos modificados y git diff --check correctos                              |

Playwright se ejecutó con Chromium 153 y configuración local temporal, sin agregar dependencias de producción. Los UI-contract interceptan API: validan comportamiento del navegador y contratos simulados, **no** persistencia SQL ni la API desplegada. Cubren pagos mixtos, preview/cierre, recuperación tras conflictos, comprobante/anulación tras refrescar, stock e interfaces administrativas.

La landing no simula un formulario exitoso ni anuncia acceso inmediato: remite al contacto existente para pedir alta asistida y avisa que el lanzamiento se está preparando.

## Validaciones pendientes

- GitHub CI del PR, incluido backend con SQL Server y migraciones. No hay dotnet/Docker/SQL Server local en este entorno.
- Nginx/TLS/DNS del nuevo hostname y smoke autenticado del servidor.
- SHA backend actual, backups/restauración y ciclo con datos persistidos en entorno de prueba.
- Operación con dos clientes aislados antes de ampliar Ruta A.
- Impresión/equipos objetivo, recuperación de cuentas y canal de soporte.

SSH a `194.238.26.70:22` devolvió `Network is unreachable`; no se cambiaron archivos del VPS, datos comerciales, registros DNS ni certificados. No es un rechazo de aprobación: falta conectividad/acceso operativo.

## Decisión

Preparación apta para PR. No declarar Cajora publicado ni activar nuevos negocios hasta cerrar las puertas de `launch.md` y registrar la evidencia faltante. Mantener alta asistida, noindex y mensaje de preparación.
