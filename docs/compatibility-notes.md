# Compatibility notes (Front/Back contracts)

Este documento registra compatibilidades temporales agregadas para evitar romper clientes existentes.

## Admin users paging

- Endpoint: `GET /api/v1/admin/users`
- Parámetros aceptados:
  - `page` (contrato actual backend)
  - `pageNumber` (legacy frontend)
- Motivo: el frontend histórico enviaba `pageNumber`, por lo que el backend ahora acepta ambos y prioriza `pageNumber` cuando viene presente.

## Admin user lock

- Endpoints aceptados:
  - `POST /api/v1/admin/users/{id}/lock` (original)
  - `PUT /api/v1/admin/users/{id}/lock` (compatibilidad)
- Cuerpo: `{ "lock": true|false }`
- Motivo: el frontend utiliza `PUT`; para compatibilidad se mantiene `POST` y se agregó `PUT` apuntando a la misma lógica.

## Admin roles DTO

- Endpoint: `GET /api/v1/admin/roles`
- Respuesta consistente: lista de objetos con forma `{ "name": "RoleName" }`.
- Motivo: se normaliza un contrato explícito y estable para frontend.

## Delete role

- Endpoint: `DELETE /api/v1/admin/roles/{name}`
- El identificador para eliminar rol es el `name` del rol.
- Motivo: el backend opera por nombre de rol; el frontend fue ajustado para evitar enviar ids inexistentes.
