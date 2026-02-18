export type PaymentMethod = 'Cash' | 'Card' | 'Transfer';

export type SelectionMode = 0 | 1;

export interface CategoryDto {
  id: string;
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
}

export interface OptionSetDto {
  id: string;
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
}

export interface SchemaDto {
  id: string;
  name: string;
  isActive: boolean;
}

export interface SelectionGroupDto {
  id: string;
  schemaId: string;
  key: string;
  label: string;
  selectionMode: SelectionMode;
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
}

export interface IncludedItemDto {
  id: string;
  productId: string;
  extraId: string;
  quantity: number;
}

export interface ProductOverrideDto {
  id: string;
  productId: string;
  groupKey: string;
  isActive: boolean;
  allowedOptionItemIds: string[];
}

export interface CatalogSnapshotDto {
  storeId: string;
  timeZoneId: string;
  generatedAtUtc: string;
  catalogVersion: string;
  etagSeed: string;
  categories: CategoryDto[];
  products: ProductDto[];
  optionSets: OptionSetDto[];
  optionItems: OptionItemDto[];
  schemas: SchemaDto[];
  selectionGroups: SelectionGroupDto[];
  extras: ExtraDto[];
  includedItems: IncludedItemDto[];
  overrides: ProductOverrideDto[];
  versionStamp: string;
}

export interface CreateSaleItemSelectionDto {
  groupKey: string;
  optionItemId: string;
}

export interface CreateSaleItemExtraDto {
  extraId: string;
  quantity: number;
}

export interface CreateSaleItemRequestDto {
  productId: string;
  quantity: number;
  selections: CreateSaleItemSelectionDto[] | null;
  extras: CreateSaleItemExtraDto[] | null;
}

export interface CreatePaymentRequestDto {
  method: PaymentMethod;
  amount: number;
  reference?: string | null;
}

export interface PaymentUiState {
  method: PaymentMethod;
  receivedAmount?: number;
  change?: number;
  reference: string;
}

export interface CreateSaleRequestDto {
  clientSaleId: string | null;
  occurredAtUtc: string | null;
  items: CreateSaleItemRequestDto[];
  payments: CreatePaymentRequestDto[];
  payment?: CreatePaymentRequestDto;
  storeId?: string;
}

export interface SaleResponseDto {
  saleId: string;
  folio: string;
  occurredAtUtc: string;
  total: number;
}

export interface DailySummaryDto {
  date: string;
  totalTickets: number;
  totalAmount: number;
  totalItems: number;
  avgTicket: number;
}

export interface TopProductDto {
  productId: string;
  productNameSnapshot: string;
  qty: number;
  amount: number;
}

export interface OpenShiftRequestDto {
  startingCashAmount: number;
  notes: string | null;
  storeId?: string;
}

export interface ShiftClosePreviewRequestDto {
  shiftId?: string;
  cashCount?: CountedDenominationDto[];
  storeId?: string;
}

export interface PaymentBreakdownDto {
  cashAmount: number;
  cardAmount: number;
  transferAmount: number;
  totalSalesCount: number;
}

export interface CountedDenominationDto {
  denominationValue: number;
  count: number;
}

export interface CloseShiftRequestDto {
  shiftId?: string;
  countedDenominations?: CountedDenominationDto[];
  closeReason?: string;
  closingNotes?: string | null;
  clientOperationId?: string;
  storeId?: string;
}

export interface ShiftClosePreviewDto {
  shiftId: string;
  openedAtUtc: string;
  openingCashAmount: number;
  salesCashTotal: number;
  expectedCashAmount: number;
  countedCashAmount?: number | null;
  difference?: number | null;
  lastCashCount?: number | null;
  breakdown?: PaymentBreakdownDto;
}

export interface CloseShiftResultDto {
  shiftId: string;
  openedAtUtc: string;
  closedAtUtc: string;
  openingCashAmount: number;
  salesCashTotal: number;
  expectedCashAmount: number;
  countedCashAmount: number;
  difference: number;
  closeNotes: string | null;
  closeReason?: string | null;
}

export interface PosShiftDto {
  id: string;
  openedAtUtc: string;
  openedByUserId: string;
  openedByEmail: string | null;
  openingCashAmount: number;
  closedAtUtc: string | null;
  closedByUserId: string | null;
  closedByEmail: string | null;
  closingCashAmount: number | null;
  expectedClosingAmount?: number | null;
  openNotes: string | null;
  closeNotes: string | null;
  storeId?: string;
}

export interface SaleVoidRequestDto {
  reasonCode: string;
  reasonText?: string;
  note?: string;
  clientVoidId?: string;
}

export interface SaleVoidResponseDto {
  saleId: string;
  status: 'Completed' | 'Void';
  voidedAtUtc: string;
}

export interface SaleListItemUi {
  saleId: string;
  folio: string;
  total: number;
  occurredAtUtc: string;
  status: 'Completed' | 'Void';
}

export interface CartSelection {
  groupKey: string;
  optionItemId: string;
  optionItemName: string;
}

export interface CartExtra {
  extraId: string;
  quantity: number;
  extraName: string;
  unitPrice: number;
}

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  basePrice: number;
  quantity: number;
  selections: CartSelection[];
  extras: CartExtra[];
}
