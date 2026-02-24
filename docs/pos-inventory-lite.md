# POS Inventory Lite v1

Alcance v1:
- Product ✅
- Extra ✅
- OptionItem ❌ (sin inventario)

Precedencia:
1. DisabledByTenant/DisabledByStore
2. ManualUnavailableInStore
3. OutOfStock (tracked + stock <= 0)
4. Available (tracked + stock > 0)
5. Available (not tracked)

## Reglas v1 inventariable

- Inventariable v1: `Product` y `Extra` cuando `IsInventoryTracked=true`.
- `OptionItem` no inventariable v1.
- Endpoints `/api/v1/pos/admin/catalog/inventory` rechazan `OptionItem` con `400` estable.

## Precedencia integrada con availability

El stock nunca sobreescribe:
- `DisabledByTenant`
- `DisabledByStore`
- `ManualUnavailable`

Solo después de esas reglas, para items inventariables, `stock<=0` => `OutOfStock`.

## Release C frontend admin UI (Inventory Lite)

- Ruta admin: `/app/admin/pos/inventory`.
- Selector obligatorio de sucursal: `data-testid="inventory-store-select"`.
- Endpoint preferido: `GET|PUT /api/v1/pos/admin/catalog/inventory`.
- Renderiza solo tipos inventariables v1:
  - `Product`
  - `Extra`
- `OptionItem` no se renderiza editable en Inventory Lite.
- Test IDs estables por fila y acciones:
  - `inventory-row-{type}-{id}`
  - `inventory-stock-input-{type}-{id}`
  - `inventory-save-{type}-{id}`
- Guardado por fila:
  - update optimista de `stockOnHandQty`,
  - rollback visual si falla,
  - manejo explícito de 400 para `OptionItem` con mensaje claro.
