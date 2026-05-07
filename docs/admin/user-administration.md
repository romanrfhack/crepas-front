# user-administration.md — Administracion de usuarios

Status: NORMATIVE
Authority: Level 1
Scope: backend | frontend | security
Last updated: 2026-05-07
Owner: Roman / arquitectura tecnica

## Resumen del modulo

La ruta funcional de Administracion de usuarios es `/admin/users` en la UI protegida de Angular. En el frontend vive en:

- `frontend/src/app/features/admin/pages/users-admin/users-admin.page.ts`
- `frontend/src/app/features/admin/models/admin.models.ts`
- `frontend/src/app/features/admin/services/admin-users.service.ts`
- `frontend/e2e/admin.users.scoped-ux.contract.spec.ts`

El backend .NET que respalda la pantalla vive en:

- `backend/src/CobranzaDigital.Api/Controllers/Admin/AdminUsersController.cs`
- `backend/src/CobranzaDigital.Application/Contracts/Admin`
- `backend/src/CobranzaDigital.Application/Interfaces/IUserAdminService.cs`
- `backend/src/CobranzaDigital.Infrastructure/Identity/UserAdminService.cs`

El modulo permite listar, filtrar, crear, editar, cambiar roles, bloquear/desbloquear y restablecer contrasenas temporales de usuarios administrables. La pantalla no debe mostrar IDs tecnicos al usuario final; los IDs pueden viajar internamente en DTOs, query params y payloads, pero la UX debe mostrar nombres legibles de roles, clientes/tenants y tiendas/sucursales.

La regla final de negocio es:

> En Administracion de usuarios, un actor solo puede ver y administrar usuarios con rol efectivo estrictamente inferior al suyo y dentro de su alcance operativo.

La autorizacion efectiva vive en backend. La UI oculta opciones no permitidas usando `allowedActions` y `/admin/users/options`, pero no es la barrera de seguridad.

## Roles disponibles

| Rol tecnico   | Nombre funcional                   | Nivel | Alcance operativo            | Accede a `/admin/users` | Crea usuarios | Roles que puede crear/asignar                                          | Restricciones                                                                                             |
| ------------- | ---------------------------------- | ----: | ---------------------------- | ----------------------- | ------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `SuperAdmin`  | Super administrador                |   100 | Global                       | Si                      | Si            | `TenantAdmin`, `AdminStore`, `Manager`, `Cashier`, `Collector`, `User` | No ve, crea, asigna ni administra `SuperAdmin` desde esta pantalla.                                       |
| `TenantAdmin` | Administrador de cliente / tenant  |    80 | Su `TenantId`                | Si                      | Si            | `AdminStore`, `Manager`, `Cashier`, `Collector`, `User`                | No ve ni administra `TenantAdmin` o `SuperAdmin`. No puede asignar tenant externo.                        |
| `AdminStore`  | Administrador de tienda / sucursal |    60 | Su `StoreId`                 | Si                      | Si            | `Manager`, `Cashier`, `Collector`, `User`                              | No ve ni administra `AdminStore`, `TenantAdmin` o `SuperAdmin`. Tenant y store quedan fijos a su alcance. |
| `Manager`     | Encargado / supervisor operativo   |    40 | Operativo, segun modulos POS | No                      | No            | Ninguno desde `/admin/users`                                           | No administra usuarios en esta version porque no existe modelo formal de equipos/supervisores/agentes.    |
| `Cashier`     | Cajero                             |    30 | Operativo de caja            | No                      | No            | Ninguno                                                                | Sin acceso a Administracion de usuarios.                                                                  |
| `Collector`   | Gestor de cobranza                 |    30 | Operativo de cobranza        | No                      | No            | Ninguno                                                                | Sin acceso a Administracion de usuarios.                                                                  |
| `User`        | Usuario basico                     |    10 | Operativo limitado           | No                      | No            | Ninguno                                                                | Sin acceso a Administracion de usuarios.                                                                  |

## Regla de jerarquia

- Solo son visibles y administrables usuarios con rol efectivo estrictamente inferior al actor.
- Un usuario con igual nivel no es visible ni administrable.
- Un usuario con nivel superior no es visible ni administrable.
- `SuperAdmin` no se administra desde `/admin/users`; tampoco aparece en el listado de otro `SuperAdmin`.
- Nadie puede crear ni asignar `SuperAdmin` desde `/admin/users`.
- Usuarios multi-rol usan el maximo nivel efectivo entre todos sus roles conocidos.
- Si un target tiene cualquier rol desconocido, falla cerrado: no aparece en el listado y no es administrable.
- Si un request intenta asignar un rol desconocido, el backend debe rechazarlo.
- El listado aplica scope + jerarquia antes de `Count`, `Skip` y `Take`, para mantener total y paginacion consistentes.

Ejemplos:

- Actor `AdminStore`, target `Manager + AdminStore`: no visible ni administrable, porque el rol efectivo del target es `AdminStore` nivel 60.
- Actor `TenantAdmin`, target `Manager + AdminStore` dentro del mismo tenant: visible y administrable, porque el maximo nivel del target es 60 y es menor que 80.
- Target `Collector + RolDesconocido`: no visible ni administrable para ningun actor desde esta pantalla.

## Regla de alcance

El alcance operativo actual de Administracion de usuarios es solo `TenantId` y `StoreId`.

| Actor                                     | Alcance                                                                                        |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `SuperAdmin`                              | Global. Puede filtrar/operar sobre tenants y stores validos, pero solo sobre roles inferiores. |
| `TenantAdmin`                             | Solo su `TenantId`. Puede elegir stores dentro de su tenant.                                   |
| `AdminStore`                              | Solo su `StoreId`. Tenant y store son fijos.                                                   |
| `Manager`, `Cashier`, `Collector`, `User` | Sin acceso a Administracion de usuarios.                                                       |

No existe todavia un modelo formal de equipos, supervisores o agentes asignados. Por eso `Manager` no tiene acceso a Administracion de usuarios en esta version.

## Flujo operativo para alta de clientes y tiendas

### Caso 1: crear nuevo cliente/tenant

Debe hacerlo un `SuperAdmin` o el flujo administrativo de plataforma correspondiente. Despues se crea el `TenantAdmin` del cliente. El `TenantAdmin` puede crear usuarios dentro de ese cliente, siempre con roles inferiores y dentro de su `TenantId`.

### Caso 2: crear nueva tienda/store dentro de un cliente

La tienda se crea desde el modulo correspondiente de plataforma/tiendas por un actor autorizado. Para crear usuarios de esa tienda:

- `SuperAdmin` puede crear usuarios permitidos en cualquier tenant/store valido.
- `TenantAdmin` del cliente puede crear `AdminStore` y usuarios operativos para stores de su tenant.
- `AdminStore` solo puede crear usuarios operativos dentro de su propia tienda/sucursal.

### Caso 3: crear usuarios operativos de tienda

- Usar `AdminStore` cuando el usuario pertenece a una sola tienda y el administrador esta dentro de esa tienda.
- Usar `TenantAdmin` cuando se configuran varias tiendas del mismo cliente.
- Usar `SuperAdmin` solo para configuracion global o soporte de plataforma.

## Tabla practica: con que usuario debo crear a quien

| Necesidad                            | Actor recomendado                                                    |
| ------------------------------------ | -------------------------------------------------------------------- |
| Crear `TenantAdmin` de cliente nuevo | `SuperAdmin`                                                         |
| Crear `AdminStore` de una tienda     | `SuperAdmin` o `TenantAdmin` del cliente                             |
| Crear `Manager` de una tienda        | `SuperAdmin`, `TenantAdmin` del cliente o `AdminStore` de esa tienda |
| Crear `Cashier`                      | `SuperAdmin`, `TenantAdmin` del cliente o `AdminStore` de esa tienda |
| Crear `Collector`                    | `SuperAdmin`, `TenantAdmin` del cliente o `AdminStore` de esa tienda |
| Crear `User`                         | `SuperAdmin`, `TenantAdmin` del cliente o `AdminStore` de esa tienda |
| Crear `SuperAdmin`                   | No desde `/admin/users`                                              |

## Endpoints relevantes

Todos los endpoints de `/api/v1/admin/users*` usan la policy de Administracion de usuarios y deben validar en backend alcance, jerarquia y payloads manipulados cuando corresponde.

| Endpoint                                           | Uso                                                                                                        | Validaciones principales                                                                                                 |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/v1/admin/users`                          | Listado paginado y filtrado. Acepta `search`, `role`, `tenantId`, `storeId`, `status`, `page`, `pageSize`. | Aplica scope del actor, filtro jerarquico, filtros permitidos, luego `Count/Skip/Take`. Query params no amplian alcance. |
| `GET /api/v1/admin/users/options`                  | Metadata segura para UI: roles asignables/visibles, tenants, stores y `currentScope`.                      | Devuelve solo opciones permitidas por actor. Manager/Cashier/Collector/User no deben acceder.                            |
| `POST /api/v1/admin/users`                         | Crear usuario.                                                                                             | Valida rol conocido/asignable, no permite `SuperAdmin`, valida tenant/store asignable y compatibilidad store-tenant.     |
| `PUT /api/v1/admin/users/{id}`                     | Editar datos basicos de usuario.                                                                           | Valida scope, jerarquia del target, roles conocidos del target y tenant/store asignable.                                 |
| `PUT /api/v1/admin/users/{id}/roles`               | Reemplazar roles.                                                                                          | Valida roles existentes, conocidos, asignables y no `SuperAdmin`; valida target administrable.                           |
| `POST /api/v1/admin/users/{id}/lock`               | Bloquear/desbloquear segun payload.                                                                        | Valida scope y jerarquia del target; roles desconocidos fallan cerrado.                                                  |
| `PUT /api/v1/admin/users/{id}/lock`                | Ruta de compatibilidad para lock/unlock.                                                                   | Mismas reglas que `POST`.                                                                                                |
| `POST /api/v1/admin/users/{id}/temporary-password` | Restablecer contrasena temporal.                                                                           | Valida scope, jerarquia del target y policy de password. No registra el password en auditoria/logs.                      |

`AdminRolesController` no debe usarse como fuente de roles asignables para `/admin/users`. La fuente segura de opciones de esta pantalla es `GET /api/v1/admin/users/options`.

## UX esperada

- No mostrar `userId`, `tenantId`, `storeId`, `roleId`, GUIDs ni IDs tecnicos como texto visible.
- Mostrar nombres legibles:
  - `tenant.name` para Cliente / Tenant.
  - `store.name` para Tienda / Sucursal.
  - `role.displayName` y descripcion cuando aplique.
- Usar selects o campos bloqueados con nombres legibles, no inputs libres para `TenantId`/`StoreId`.
- `TenantAdmin` ve tenant fijo y stores de su tenant.
- `AdminStore` ve tenant/store fijos; no debe escribirlos manualmente.
- Acciones visibles dependen de `allowedActions` calculado por backend.
- Filtros disponibles aplican server-side: busqueda, rol, tenant, store, estado, pagina y tamano de pagina.
- Cambiar filtros debe resetear pagina a 1.
- Mensajes al usuario deben evitar terminos tecnicos como `TenantId requerido`; usar textos como "Selecciona una empresa." o "Selecciona una sucursal.".

## Seguridad y restricciones

- Backend es la fuente de verdad de autorizacion.
- Payloads manipulados deben rechazarse aunque la UI oculte controles.
- Query params manipulados no deben ampliar alcance.
- Roles desconocidos no son visibles, no son asignables y no son administrables.
- `SuperAdmin` no es asignable desde esta pantalla.
- Targets con rol igual o superior no aparecen en listado y no pueden modificarse por endpoint directo.
- El catalogo centralizado de roles en backend debe mantenerse sincronizado con roles sembrados en Identity.
- No existe jerarquia persistida en `ApplicationRole`; la jerarquia actual vive en codigo de autorizacion.

## Backlog conocido

- Endurecer o restringir `AdminRolesController`, que puede exponer roles globales. `/admin/users` ya no depende de ese endpoint para roles asignables.
- Documentar/probar sincronizacion entre el catalogo centralizado de roles y los roles sembrados por Identity.
- Disenar modelo futuro de equipos/supervisores/agentes antes de habilitar administracion de usuarios para `Manager`.
- Evaluar si conviene una FK explicita `ApplicationUser.TenantId -> Tenant` y validaciones relacionales adicionales.
