# Evidencia de preparación Cajora

Actualizado: 2026-10-07 (America/Mexico_City). Base: main `c7caa8d26ba2d1cd5935fcaeaa559156ea6e263c`.
Estado: CI aprobado, landing HTTPS publicada y QA API operativo aprobado en VPS; lanzamiento pendiente de aceptación visual y puertas operativas restantes.

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

## Estado operativo actual

- Landing en `https://cajora.leroa.com.mx` publicada con HTTPS; login redirige temporalmente al sitio existente.
- CrepasDB respaldada COPY_ONLY/CHECKSUM y validada mediante VERIFYONLY; migraciones pendientes aplicadas y CategoryCode verificado. API reportada active/Healthy.
- QA API real del run bc15642e73ab aprobado: ventas/pagos, idempotencia, anulación e inventario, cierre y persistencia tras login, aislamiento A/B. Evidencia y alcance en [qa-controlled-run.md](qa-controlled-run.md).
- Son resultados reportados por el operador del VPS; el chat no tiene SSH al servidor ni leyó el JSON final.

## Validaciones pendientes

- Aceptación manual del navegador contra API real y prueba en dispositivos/impresión objetivo.
- Prueba integral de restauración del respaldo (VERIFYONLY no la sustituye).
- Recuperación de cuentas y canal de soporte.
- Despliegue completo de la identidad Cajora, versión exacta de la API activa y cierre del endpoint auxiliar admin/users/options que sigue sin verificarse tras reparación de esquema.
- Cerrar puertas restantes de launch.md antes de ampliar onboarding comercial; mantener alta asistida y lanzamiento controlado.

## Antecedentes de preparación

Las secciones siguientes registran los cortes anteriores de CI y restricciones de conectividad del chat; el estado vigente es el indicado arriba.

## Bloqueo detectado por CI y corrección mínima

El primer CI del PR falló en restore con NU1903 para Microsoft.OpenApi 2.3.10 (GHSA-v5pm-xwqc-g5wc). Se actualiza únicamente ese paquete a 2.7.5, versión corregida de la misma línea mayor según el [aviso del mantenedor](https://github.com/advisories/GHSA-v5pm-xwqc-g5wc). No se desactiva NuGet Audit ni warnings-as-errors. Compilación, migraciones y suite backend deben pasar nuevamente antes de declarar validado el cambio.

## Concurrencia detectada en SQL Server

CI del commit 3cc3133 pasó restore/build/migraciones; 10 pruebas de Application y 162 de 163 pruebas API aprobaron. Falló InventoryV2_Adjustments_Delta_Concurrent_Requests_Eventually_Succeed (un ajuste devolvió 500). La revisión encontró falta de manejo de carrera al insertar el primer saldo bajo el índice único. Se agrega retry acotado a ese índice y se refuerza la regresión para comprobar saldo y movimientos sin duplicación. El CI 37553326018 del commit 84d6ed0593fa872b7f4eb9d668daec164ffe2098 confirmó la corrección con backend_tests y frontend_tests aprobados. V2 continúa fuera del básico.

## Cierre de validación CI

Verificados los jobs backend_tests (112573740758) y frontend_tests (112573740765): restore, build, migraciones, tests backend, build Angular, unit y UI-contract en success. Al ser un PR, empaquetado y deploy se omiten deliberadamente. En ese corte aún no se había publicado la landing de Cajora.

La comprobación de acceso desde este entorno devuelve Network is unreachable al VPS por SSH y error de resolución DNS para los hostnames de Leroa. Este resultado no prueba que el dominio esté mal configurado; impide comprobarlo desde esta red. En ese corte publicación, backup/restore y smoke autenticado seguían pendientes; el estado vigente está arriba.
