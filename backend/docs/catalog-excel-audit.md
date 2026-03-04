# Auditoría técnica del modelo de catálogo (exportación/importación Excel)

## Alcance revisado
- Dominio y entidades del catálogo (`PosCatalogEntities`).
- Configuración EF Core (`PosCatalogConfigurations`, `DbContext`).
- Servicios de aplicación usados por API (`PosCatalogService`).
- Contratos/DTOs (`PosCatalogDtos`).
- Endpoints API de administración y snapshot (`PosAdminCatalogController`, `PosCatalogController`).
- Frontend de administración y POS (modelos y páginas clave).
- Tests y documentación existente.

## Estructura real confirmada

### Núcleo de plantilla de catálogo
1. `CatalogTemplate` es la raíz lógica de definición del catálogo por vertical.
2. `TenantCatalogTemplate` asigna **un template por tenant** (PK = `TenantId`).
3. Entidades de catálogo de contenido (`Category`, `Product`, `OptionSet`, `OptionItem`, `CustomizationSchema`, `SelectionGroup`, `Extra`) cargan `CatalogTemplateId` para segmentación.

### Jerarquía funcional (confirmada por FK + uso en snapshot)
- `Category (1) -> Product (N)` por `Product.CategoryId`.
- `CustomizationSchema (1) -> Product (N opcional)` por `Product.CustomizationSchemaId` nullable.
- `CustomizationSchema (1) -> SelectionGroup (N)` por `SelectionGroup.SchemaId`.
- `OptionSet (1) -> SelectionGroup (N)` por `SelectionGroup.OptionSetId`.
- `OptionSet (1) -> OptionItem (N)` por `OptionItem.OptionSetId`.

> Importante: el flujo real no es una cadena estricta `Producto -> Schema -> Group -> OptionSet -> Option` “propietaria” en todos los niveles. `OptionSet` existe como entidad independiente del grupo y puede ser referenciado por múltiples grupos.

### Relaciones adicionales relevantes
- `Extra` es catálogo paralelo (no cuelga de schema/group), también por `CatalogTemplateId`.
- `IncludedItem` relaciona `Product` con `Extra` (N:N modelado con entidad explícita + `Quantity`).
- `ProductGroupOverride` define override por `(ProductId, GroupKey)`.
- `ProductGroupOverrideAllowedItem` enlaza override con múltiples `OptionItem` (N:N).
- Overrides operativos por tenant/tienda (`TenantCatalogOverride`, `StoreCatalogAvailability`, `StoreCatalogOverride`) y existencias (`CatalogInventoryBalance`, `CatalogInventoryAdjustment`) afectan disponibilidad efectiva del snapshot.

## Cardinalidades y restricciones destacables
- `SelectionGroup` tiene índice único `(SchemaId, Key)`.
- `ProductGroupOverride` tiene índice único `(ProductId, GroupKey)`.
- `ProductGroupOverrideAllowedItem` PK compuesta `(ProductGroupOverrideId, OptionItemId)`.
- `TenantCatalogTemplate` PK `TenantId` (1 template activo/mapeado por tenant).
- `Product.ExternalCode` tiene índice único global (nullable).
- `Category` tiene único `(CatalogTemplateId, Name)`.
- Todas las FK catalogadas usan `DeleteBehavior.Restrict`.

## Hallazgos críticos para Excel

### 1) Reutilización real (impacta diseño tabular)
- Un `CustomizationSchema` puede ser usado por múltiples productos (FK nullable en `Product`).
- Un `OptionSet` puede ser usado por múltiples grupos (no hay unicidad sobre `OptionSetId` en `SelectionGroup`).
- Un `OptionItem` pertenece a un solo `OptionSet`, pero puede participar en múltiples overrides vía tabla puente.

### 2) Riesgos de consistencia inter-template
En el servicio hay validación de schema activo para producto, pero no validación explícita de pertenencia al mismo `CatalogTemplateId` para todos los vínculos al crear/actualizar:
- `Product.CategoryId` se asigna directo sin validar template de categoría.
- `SelectionGroup` permite `SchemaId`/`OptionSetId` recibidos sin validar template cruzado.

Esto abre riesgo de referencias cruzadas entre templates si se importa con IDs técnicos.

### 3) Limitaciones de “hoja única”
Aplanar todo en una sola hoja produciría duplicación alta por combinaciones:
- Producto × Grupos del schema × OptionItems del OptionSet × Extras incluidos × Overrides permitidos.
- Difícil de validar y mantener para negocio.

## Recomendación de estructura para Excel

### Estrategia recomendada: plantilla **multi-hoja normalizada + validaciones**

#### Hoja 1: `Categorias`
- `CategoryCode` (clave natural recomendada)
- `CategoryName`
- `SortOrder`
- `IsActive`

#### Hoja 2: `Schemas`
- `SchemaCode`
- `SchemaName`
- `IsActive`

#### Hoja 3: `OptionSets`
- `OptionSetCode`
- `OptionSetName`
- `IsActive`

#### Hoja 4: `OptionItems`
- `OptionSetCode`
- `OptionItemCode`
- `OptionItemName`
- `SortOrder`
- `IsActive`
- `IsAvailable`

#### Hoja 5: `SelectionGroups`
- `SchemaCode`
- `GroupKey`
- `GroupLabel`
- `SelectionMode` (`Single|Multi`)
- `MinSelections`
- `MaxSelections`
- `OptionSetCode`
- `SortOrder`
- `IsActive`

#### Hoja 6: `Productos`
- `ProductCode` (externo / SKU funcional)
- `ProductName`
- `CategoryCode`
- `SubcategoryName`
- `BasePrice`
- `IsActive`
- `IsAvailable`
- `IsInventoryTracked`
- `SchemaCode` (nullable)

#### Hoja 7: `Extras`
- `ExtraCode`
- `ExtraName`
- `Price`
- `IsActive`
- `IsAvailable`
- `IsInventoryTracked`

#### Hoja 8: `IncludedItems`
- `ProductCode`
- `ExtraCode`
- `Quantity`

#### Hoja 9: `ProductGroupOverrides` (opcional, avanzado)
- `ProductCode`
- `GroupKey`
- `IsActive`

#### Hoja 10: `ProductGroupOverrideAllowedItems` (opcional, avanzado)
- `ProductCode`
- `GroupKey`
- `OptionItemCode`

## Estrategia de adopción sugerida
1. Fase 1: export/import solo núcleo (`Categorias`, `Productos`, `Schemas`, `SelectionGroups`, `OptionSets`, `OptionItems`).
2. Fase 2: agregar `Extras` e `IncludedItems`.
3. Fase 3: overrides e inventario en plantillas separadas (operación, no catálogo base).

## Criterios para que sea entendible para negocio
- No exponer GUID como clave primaria de trabajo.
- Usar códigos naturales estables (`ProductCode`, `SchemaCode`, etc.) + validaciones cruzadas.
- Mantener IDs internos solo como metadato técnico opcional de exportación.

## Conclusión
Sí es exportable/importable a Excel, pero **no recomendable** en hoja única. La estructura real exige plantilla multi-hoja por reutilización de schemas/option sets y relaciones N:N (incluidos/overrides). La opción más segura es una plantilla normalizada con claves naturales y validaciones de integridad referencial.
