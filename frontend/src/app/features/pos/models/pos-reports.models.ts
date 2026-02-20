export interface PosReportFilters {
  dateFrom: string;
  dateTo: string;
  storeId?: string;
  cashierUserId?: string;
  shiftId?: string;
}

export interface DailySalesReportItemDto {
  businessDate: string;
  tickets: number;
  subtotal: number;
  discounts: number;
  tax: number;
  totalSales: number;
  avgTicket: number;
  voidsCount: number;
  voidsTotal: number;
  payments: {
    cash: number;
    card: number;
    transfer: number;
  };
}

export interface PaymentsByMethodSummaryDto {
  dateFrom: string;
  dateTo: string;
  totals: Array<{
    method: 'Cash' | 'Card' | 'Transfer' | string;
    count: number;
    amount: number;
  }>;
}

export interface HourlySalesReportItemDto {
  hour: number;
  tickets: number;
  totalSales: number;
}

export interface CashierSalesReportItemDto {
  cashierUserId: string;
  cashierUserName?: string;
  tickets: number;
  totalSales: number;
  avgTicket: number;
  voidsCount: number;
  voidsTotal: number;
  payments: {
    cash: number;
    card: number;
    transfer: number;
  };
}

export interface ShiftSummaryReportItemDto {
  shiftId: string;
  cashierUserId: string;
  openedAtUtc: string;
  closedAtUtc: string | null;
  closeReason: string | null;
  tickets: number;
  totalSales: number;
  payments: {
    cash: number;
    card: number;
    transfer: number;
  };
  closingExpectedCashAmount: number;
  closingCountedCashAmount: number;
  cashDifference: number;
}

export interface VoidReasonReportItemDto {
  reasonCode: string;
  reasonText: string;
  count: number;
  amount: number;
}

export interface TopProductReportItemDto {
  productId: string;
  productNameSnapshot: string;
  qty: number;
  amount: number;
}

export interface SalesMixByCategoryItemDto {
  categoryId: string;
  categoryName: string;
  tickets: number;
  quantity: number;
  grossSales: number;
}

export interface SalesMixByCategoriesDto {
  items: SalesMixByCategoryItemDto[];
}

export interface SalesMixByProductItemDto {
  productId: string;
  sku: string | null;
  productName: string;
  tickets: number;
  quantity: number;
  grossSales: number;
}

export interface SalesMixByProductsDto {
  items: SalesMixByProductItemDto[];
}

export interface AddonsExtraUsageItemDto {
  extraId: string;
  extraSku: string | null;
  extraName: string;
  quantity: number;
  grossSales: number;
}

export interface AddonsExtrasUsageDto {
  items: AddonsExtraUsageItemDto[];
}

export interface AddonsOptionUsageItemDto {
  optionItemId: string;
  optionItemSku: string | null;
  optionItemName: string;
  usageCount: number;
  grossImpact: number;
}

export interface AddonsOptionsUsageDto {
  items: AddonsOptionUsageItemDto[];
}

export interface KpisSummaryDto {
  tickets: number;
  totalItems: number;
  grossSales: number;
  avgTicket: number;
  avgItemsPerTicket: number;
  voidCount: number;
  voidRate: number;
}

export interface CashDifferencesDailyItemDto {
  date: string;
  cashierUserId: string | null;
  shifts: number;
  expectedCash: number;
  countedCash: number;
  difference: number;
  reasonCount: number;
}

export interface CashDifferencesShiftItemDto {
  shiftId: string;
  openedAt: string;
  closedAt: string | null;
  cashierUserId: string;
  cashierUserName?: string;
  expectedCash: number;
  countedCash: number;
  difference: number;
  closeReason: string | null;
}

export interface CashDifferencesControlDto {
  daily: CashDifferencesDailyItemDto[];
  shifts: CashDifferencesShiftItemDto[];
}
