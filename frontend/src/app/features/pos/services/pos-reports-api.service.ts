import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../../core/services/api-client';
import {
  AddonsExtrasUsageDto,
  AddonsOptionsUsageDto,
  CashDifferencesControlDto,
  CashierSalesReportItemDto,
  DailySalesReportItemDto,
  HourlySalesReportItemDto,
  KpisSummaryDto,
  PaymentsByMethodSummaryDto,
  PosReportFilters,
  SalesMixByCategoriesDto,
  SalesMixByProductsDto,
  ShiftSummaryReportItemDto,
  TopProductReportItemDto,
  VoidReasonReportItemDto,
} from '../models/pos-reports.models';
import { StoreContextService } from './store-context.service';

interface TopProductsParams extends PosReportFilters {
  top?: number;
}

interface TopV2Params extends PosReportFilters {
  top?: number;
}

@Injectable({ providedIn: 'root' })
export class PosReportsApiService {
  private readonly apiClient = inject(ApiClient);
  private readonly storeContext = inject(StoreContextService);

  getDailySales(params: PosReportFilters) {
    return firstValueFrom(
      this.apiClient.get<DailySalesReportItemDto[]>(
        this.buildPath('/v1/pos/reports/sales/daily', params),
      ),
    );
  }

  getPaymentsByMethod(params: PosReportFilters) {
    return firstValueFrom(
      this.apiClient.get<PaymentsByMethodSummaryDto>(
        this.buildPath('/v1/pos/reports/payments/methods', params),
      ),
    );
  }

  getHourlySales(params: PosReportFilters) {
    return firstValueFrom(
      this.apiClient.get<HourlySalesReportItemDto[]>(
        this.buildPath('/v1/pos/reports/sales/hourly', params),
      ),
    );
  }

  getCashiers(params: PosReportFilters) {
    return firstValueFrom(
      this.apiClient.get<CashierSalesReportItemDto[]>(
        this.buildPath('/v1/pos/reports/sales/cashiers', params),
      ),
    );
  }

  getShiftsSummary(params: Omit<PosReportFilters, 'shiftId'>) {
    return firstValueFrom(
      this.apiClient.get<ShiftSummaryReportItemDto[]>(
        this.buildPath('/v1/pos/reports/shifts/summary', params),
      ),
    );
  }

  getVoidReasons(params: PosReportFilters) {
    return firstValueFrom(
      this.apiClient.get<VoidReasonReportItemDto[]>(
        this.buildPath('/v1/pos/reports/voids/reasons', params),
      ),
    );
  }

  getTopProducts(params: TopProductsParams) {
    return firstValueFrom(
      this.apiClient.get<TopProductReportItemDto[]>(
        this.buildPath('/v1/pos/reports/top-products', params),
      ),
    );
  }

  getKpisSummary(params: PosReportFilters) {
    return firstValueFrom(
      this.apiClient.get<KpisSummaryDto>(this.buildPath('/v1/pos/reports/kpis/summary', params)),
    );
  }

  getSalesMixByCategories(params: PosReportFilters) {
    return firstValueFrom(
      this.apiClient.get<SalesMixByCategoriesDto>(
        this.buildPath('/v1/pos/reports/sales/categories', params),
      ),
    );
  }

  getSalesMixByProducts(params: TopV2Params) {
    return firstValueFrom(
      this.apiClient.get<SalesMixByProductsDto>(
        this.buildPath('/v1/pos/reports/sales/products', params),
      ),
    );
  }

  getAddonsExtrasUsage(params: TopV2Params) {
    return firstValueFrom(
      this.apiClient.get<AddonsExtrasUsageDto>(
        this.buildPath('/v1/pos/reports/sales/addons/extras', params),
      ),
    );
  }

  getAddonsOptionsUsage(params: TopV2Params) {
    return firstValueFrom(
      this.apiClient.get<AddonsOptionsUsageDto>(
        this.buildPath('/v1/pos/reports/sales/addons/options', params),
      ),
    );
  }

  getCashDifferencesControl(params: Omit<PosReportFilters, 'shiftId'>) {
    return firstValueFrom(
      this.apiClient.get<CashDifferencesControlDto>(
        this.buildPath('/v1/pos/reports/control/cash-differences', params),
      ),
    );
  }

  private buildPath(basePath: string, params: object) {
    const effective = this.withStoreContext(params);
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(effective)) {
      if (value === undefined || value === null || `${value}`.trim().length === 0) {
        continue;
      }

      query.set(key, `${value}`);
    }

    const queryString = query.toString();
    return queryString.length > 0 ? `${basePath}?${queryString}` : basePath;
  }

  private withStoreContext(params: object) {
    const queryParams = params as Record<string, string | number | undefined>;

    if (typeof queryParams['storeId'] === 'string' && queryParams['storeId'].trim().length > 0) {
      return queryParams;
    }

    const activeStoreId = this.storeContext.getActiveStoreId();
    if (!activeStoreId) {
      return queryParams;
    }

    return {
      ...queryParams,
      storeId: activeStoreId,
    };
  }
}
