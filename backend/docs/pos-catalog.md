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
