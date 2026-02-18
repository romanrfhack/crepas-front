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
