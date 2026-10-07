# Evidencia de preparación Cajora

Fecha: 2026-10-06 (America/Mexico_City). Base: main `c7caa8d26ba2d1cd5935fcaeaa559156ea6e263c`.
Estado: frontend y backend validados por CI; lanzamiento pendiente de validación operativa del host.

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

- CI del PR aprobado para el commit 84d6ed0593fa872b7f4eb9d668daec164ffe2098: build, migraciones SQL Server, pruebas backend, build frontend, unit tests y UI-contract. Evidencia: https://github.com/romanrfhack/crepas-front/actions/runs/37553326018 . No sustituye la validación del host.
- Nginx/TLS/DNS del nuevo hostname y smoke autenticado del servidor.
- SHA backend actual, backups/restauración y ciclo con datos persistidos en entorno de prueba.
- Operación con dos clientes aislados antes de ampliar Ruta A.
- Impresión/equipos objetivo, recuperación de cuentas y canal de soporte.

SSH a `194.238.26.70:22` devolvió `Network is unreachable`; no se cambiaron archivos del VPS, datos comerciales, registros DNS ni certificados. No es un rechazo de aprobación: falta conectividad/acceso operativo.

## Decisión

Preparación apta para PR. No declarar Cajora publicado ni activar nuevos negocios hasta cerrar las puertas de `launch.md` y registrar la evidencia faltante. Mantener alta asistida, noindex y mensaje de preparación.

## Bloqueo detectado por CI y corrección mínima

El primer CI del PR falló en restore con NU1903 para Microsoft.OpenApi 2.3.10 (GHSA-v5pm-xwqc-g5wc). Se actualiza únicamente ese paquete a 2.7.5, versión corregida de la misma línea mayor según el [aviso del mantenedor](https://github.com/advisories/GHSA-v5pm-xwqc-g5wc). No se desactiva NuGet Audit ni warnings-as-errors. Compilación, migraciones y suite backend deben pasar nuevamente antes de declarar validado el cambio.

## Concurrencia detectada en SQL Server

CI del commit 3cc3133 pasó restore/build/migraciones; 10 pruebas de Application y 162 de 163 pruebas API aprobaron. Falló InventoryV2_Adjustments_Delta_Concurrent_Requests_Eventually_Succeed (un ajuste devolvió 500). La revisión encontró falta de manejo de carrera al insertar el primer saldo bajo el índice único. Se agrega retry acotado a ese índice y se refuerza la regresión para comprobar saldo y movimientos sin duplicación. El CI 37553326018 del commit 84d6ed0593fa872b7f4eb9d668daec164ffe2098 confirmó la corrección con backend_tests y frontend_tests aprobados. V2 continúa fuera del básico.

## Cierre de validación CI

Verificados los jobs backend_tests (112573740758) y frontend_tests (112573740765): restore, build, migraciones, tests backend, build Angular, unit y UI-contract en success. Al ser un PR, empaquetado y deploy se omiten deliberadamente. No se ha publicado Cajora.

La comprobación de acceso desde este entorno devuelve Network is unreachable al VPS por SSH y error de resolución DNS para los hostnames de Leroa. Este resultado no prueba que el dominio esté mal configurado; impide comprobarlo desde esta red. Publicación, backup/restore y smoke autenticado siguen pendientes.
