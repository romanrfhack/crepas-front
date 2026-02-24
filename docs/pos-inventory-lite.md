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
