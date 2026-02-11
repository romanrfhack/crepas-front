export interface CategoryDto {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface UpsertCategoryRequest {
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ProductDto {
  id: string;
  externalCode: string | null;
  name: string;
  categoryId: string;
  subcategoryName: string | null;
  basePrice: number;
  isActive: boolean;
  customizationSchemaId: string | null;
}

export interface UpsertProductRequest {
  externalCode: string | null;
  name: string;
  categoryId: string;
  subcategoryName: string | null;
  basePrice: number;
  isActive: boolean;
  customizationSchemaId: string | null;
}

export interface OptionSetDto {
  id: string;
  name: string;
  isActive: boolean;
}

export interface UpsertOptionSetRequest {
  name: string;
  isActive: boolean;
}

export interface OptionItemDto {
  id: string;
  optionSetId: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

export interface UpsertOptionItemRequest {
  name: string;
  isActive: boolean;
  sortOrder: number;
}

export interface SchemaDto {
  id: string;
  name: string;
  isActive: boolean;
}

export interface UpsertSchemaRequest {
  name: string;
  isActive: boolean;
}

export interface SelectionGroupDto {
  id: string;
  schemaId: string;
  key: string;
  label: string;
  selectionMode: number;
  minSelections: number;
  maxSelections: number;
  optionSetId: string;
  isActive: boolean;
  sortOrder: number;
}

export interface UpsertSelectionGroupRequest {
  key: string;
  label: string;
  selectionMode: number;
  minSelections: number;
  maxSelections: number;
  optionSetId: string;
  isActive: boolean;
  sortOrder: number;
}

export interface ExtraDto {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
}

export interface UpsertExtraRequest {
  name: string;
  price: number;
  isActive: boolean;
}

export interface IncludedItemDto {
  id: string;
  productId: string;
  extraId: string;
  quantity: number;
}

export interface ReplaceIncludedItemRow {
  extraId: string;
  quantity: number;
}

export interface ReplaceIncludedItemsRequest {
  items: ReplaceIncludedItemRow[];
}

export interface ProductOverrideDto {
  id: string;
  productId: string;
  groupKey: string;
  isActive: boolean;
  allowedOptionItemIds: string[];
}

export interface OverrideUpsertRequest {
  allowedOptionItemIds: string[];
}
