# POS Catálogo tipado

## Modelo
Incluye Category, Product, OptionSet/OptionItem, CustomizationSchema/SelectionGroup, Extra, IncludedItem y ProductGroupOverride con allowed items.

## Endpoints
- `GET/POST/PUT/DELETE /api/v1/pos/admin/categories`
- `GET/POST/PUT/DELETE /api/v1/pos/admin/products`
- `GET/POST/PUT/DELETE /api/v1/pos/admin/option-sets`
- `GET/POST/PUT/DELETE /api/v1/pos/admin/option-sets/{optionSetId}/items`
- `GET/POST/PUT/DELETE /api/v1/pos/admin/schemas`
- `GET/POST/PUT/DELETE /api/v1/pos/admin/schemas/{schemaId}/groups`
- `GET/POST/PUT/DELETE /api/v1/pos/admin/extras`
- `GET/PUT /api/v1/pos/admin/products/{productId}/included-items`
- `PUT /api/v1/pos/admin/products/{productId}/overrides/{groupKey}`
- `GET /api/v1/pos/catalog/snapshot`

## Snapshot ejemplo
```json
{
  "categories": [{ "id": "...", "name": "Bebidas", "sortOrder": 1, "isActive": true }],
  "products": [{ "id": "...", "name": "Café", "basePrice": 45.00, "isActive": true }],
  "optionSets": [],
  "optionItems": [],
  "schemas": [],
  "selectionGroups": [],
  "extras": [],
  "includedItems": [],
  "overrides": [],
  "versionStamp": "ABCDEF..."
}
```


## Resolución de tienda efectiva (`/pos/catalog/snapshot`)
Precedencia final para resolver `storeId` en contexto multi-tenant:
1. `storeId` explícito del request (`?storeId=`).
2. `storeId` contextual del usuario actual (claim JWT `storeId`; fallback al `AspNetUsers.StoreId`).
3. `PosSettings.DefaultStoreId` **solo** como último fallback y únicamente si pertenece al `tenant` efectivo y la store está activa.

Si una tienda candidata no pertenece al tenant efectivo, se descarta y se evalúa el siguiente candidato (sin contaminación cross-tenant). Si no hay ninguna tienda válida, el endpoint responde `404 Store was not found for current tenant.`
