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
  isAvailable: boolean;
  customizationSchemaId: string | null;
  isInventoryTracked?: boolean | null;
  stockOnHandQty?: number | null;
  availabilityReason?: string | null;
  storeOverrideState?: string | null;
}

export interface UpsertProductRequest {
  externalCode: string | null;
  name: string;
  categoryId: string;
  subcategoryName: string | null;
  basePrice: number;
  isActive: boolean;
  isAvailable: boolean;
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
  isAvailable: boolean;
  sortOrder: number;
  availabilityReason?: string | null;
  storeOverrideState?: string | null;
}

export interface UpsertOptionItemRequest {
  name: string;
  isActive: boolean;
  isAvailable: boolean;
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
  isAvailable: boolean;
  isInventoryTracked?: boolean | null;
  stockOnHandQty?: number | null;
  availabilityReason?: string | null;
  storeOverrideState?: string | null;
}

export interface UpsertExtraRequest {
  name: string;
  price: number;
  isActive: boolean;
  isAvailable: boolean;
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

export interface StoreInventoryItemDto {
  storeId: string;
  productId: string;
  productName: string;
  productSku?: string | null;
  onHand: number;
  reserved: number;
  updatedAtUtc: string | null;
  hasInventoryRow: boolean;
}

export interface UpsertStoreInventoryRequest {
  storeId: string;
  productId: string;
  onHand: number;
}

export interface PosInventorySettingsDto {
  showOnlyInStock: boolean;
}

export interface CatalogInventoryItemDto {
  storeId: string;
  itemType: string;
  itemId: string;
  onHandQty: number;
  updatedAtUtc: string;
  itemName?: string | null;
  itemSku?: string | null;
  isInventoryTracked?: boolean | null;
}

export interface UpsertCatalogInventoryRequest {
  storeId: string;
  itemType: CatalogItemType;
  itemId: string;
  onHandQty: number;
  reason?: string | null;
  reference?: string | null;
}

export type InventoryAdjustmentReason =
  | 'InitialLoad'
  | 'Purchase'
  | 'Return'
  | 'Waste'
  | 'Damage'
  | 'Correction'
  | 'TransferIn'
  | 'TransferOut'
  | 'ManualCount'
  | 'SaleConsumption'
  | 'VoidReversal';

export type InventoryAdjustmentReasonValue = InventoryAdjustmentReason | (string & {});

export interface CreateCatalogInventoryAdjustmentRequest {
  storeId: string;
  itemType: Extract<CatalogItemType, 'Product' | 'Extra'>;
  itemId: string;
  quantityDelta: number;
  reason: InventoryAdjustmentReason;
  reference?: string | null;
  note?: string | null;
  clientOperationId?: string | null;
}

export interface CatalogInventoryAdjustmentDto {
  id: string;
  storeId: string;
  itemType: Extract<CatalogItemType, 'Product' | 'Extra'>;
  itemId: string;
  qtyBefore: number;
  qtyDelta: number;
  qtyAfter: number;
  reason: InventoryAdjustmentReasonValue;
  reference?: string | null;
  note?: string | null;
  clientOperationId?: string | null;
  createdAtUtc: string;
  performedByUserId: string;
  itemName?: string | null;
  itemSku?: string | null;
}
export type CatalogItemType = 'Product' | 'Extra' | 'OptionItem';
