# Auditoría (AuditLog)

`AuditLog` es el registro persistido para trazabilidad funcional y operativa de acciones relevantes del sistema.

## Campos

Campos existentes (compatibles):
- `Id`
- `Action`
- `Actor`
- `OccurredAt`
- `Metadata`

Campos nuevos (todos nullable para backward compatibility):
- `OccurredAtUtc`
- `UserId`
- `EntityType`
- `EntityId`
- `BeforeJson`
- `AfterJson`
- `CorrelationId`
- `Source`
- `Notes`

## Convención de `Action`

Para mantener consistencia entre módulos, usa constantes compartidas (`AuditActions`) y strings descriptivos en PascalCase:

- `CreateRole`
- `DeleteRole`
- `LockUser`
- `UnlockUser`

Al agregar nuevos casos en catálogo/ventas/lealtad, seguir el mismo patrón:
- `CreateX`, `UpdateX`, `DeleteX`
- `AssignX`, `RevokeX`
- `SyncX`, `ImportX`

## Cómo agregar auditoría a nuevos módulos

1. Inyectar `IAuditLogger` en el punto de entrada (controller/handler/service de aplicación).
2. Obtener contexto de request (correlationId y userId) desde `IAuditRequestContextAccessor`.
3. Crear `AuditEntry` con:
   - `Action`
   - `EntityType` y `EntityId`
   - `Before` / `After` (objetos simples serializables)
   - `Source = "Api"` (u otro origen como `PosSync`)
4. Llamar `await _auditLogger.LogAsync(entry, ct)`.
5. Emitir log estructurado adicional `audit_log_written` para trazabilidad en observabilidad.

> `AuditLogger` es **best effort**: si falla persistencia, se registra warning y no tumba la request.

## Ejemplo de entrada

```json
{
  "action": "LockUser",
  "actor": "2f5c8f6b-57ff-4f39-995f-14b95f6cb9cd",
  "occurredAt": "2026-02-11T14:36:21.120+00:00",
  "occurredAtUtc": "2026-02-11T14:36:21.120Z",
  "userId": "2f5c8f6b-57ff-4f39-995f-14b95f6cb9cd",
  "entityType": "User",
  "entityId": "93f851be-92c5-4f81-ac34-0c57cb421f61",
  "beforeJson": "{\"locked\":false}",
  "afterJson": "{\"locked\":true}",
  "correlationId": "0f7f8eb6f9d14ef2bc2dd249cd9d3a91",
  "source": "Api",
  "notes": null
}
```
