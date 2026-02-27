import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../../core/services/api-client';
import {
  PlatformActivityFeedQuery,
  PlatformActivityFeedResponseDto,
  PlatformDashboardAlertsResponseDto,
  PlatformExecutiveSignalsDto,
  PlatformExecutiveSignalsQuery,
  PlatformDashboardSummaryDto,
  PlatformOutOfStockQuery,
  PlatformOutOfStockResponseDto,
  PlatformRecentInventoryAdjustmentsQuery,
  PlatformRecentInventoryAdjustmentsResponseDto,
  PlatformSalesTrendQuery,
  PlatformSalesTrendResponseDto,
  PlatformStockoutHotspotsQuery,
  PlatformStockoutHotspotsResponseDto,
  PlatformSummaryQuery,
  PlatformTopVoidTenantsQuery,
  PlatformTopVoidTenantsResponseDto,
  PlatformTopTenantsQuery,
  PlatformTopTenantsResponseDto,
} from '../models/platform.models';

@Injectable({ providedIn: 'root' })
export class PlatformDashboardApiService {
  private readonly apiClient = inject(ApiClient);
  private readonly basePath = '/v1/platform/dashboard';

  getSummary(query?: PlatformSummaryQuery) {
    return firstValueFrom(
      this.apiClient.get<PlatformDashboardSummaryDto>(this.buildPath('/summary', query)),
    );
  }

  getTopTenants(query?: PlatformTopTenantsQuery) {
    return firstValueFrom(
      this.apiClient.get<PlatformTopTenantsResponseDto>(this.buildPath('/top-tenants', query)),
    );
  }

  getAlerts() {
    return firstValueFrom(this.apiClient.get<PlatformDashboardAlertsResponseDto>(`${this.basePath}/alerts`));
  }

  getRecentInventoryAdjustments(query?: PlatformRecentInventoryAdjustmentsQuery) {
    return firstValueFrom(
      this.apiClient.get<PlatformRecentInventoryAdjustmentsResponseDto>(
        this.buildPath('/recent-inventory-adjustments', query),
      ),
    );
  }

  getOutOfStock(query?: PlatformOutOfStockQuery) {
    return firstValueFrom(
      this.apiClient.get<PlatformOutOfStockResponseDto>(this.buildPath('/out-of-stock', query)),
    );
  }

  getSalesTrend(query?: PlatformSalesTrendQuery) {
    return firstValueFrom(
      this.apiClient.get<PlatformSalesTrendResponseDto>(this.buildPath('/sales-trend', query)),
    );
  }

  getTopVoidTenants(query?: PlatformTopVoidTenantsQuery) {
    return firstValueFrom(
      this.apiClient.get<PlatformTopVoidTenantsResponseDto>(this.buildPath('/top-void-tenants', query)),
    );
  }

  getStockoutHotspots(query?: PlatformStockoutHotspotsQuery) {
    return firstValueFrom(
      this.apiClient.get<PlatformStockoutHotspotsResponseDto>(
        this.buildPath('/stockout-hotspots', query),
      ),
    );
  }

  getActivityFeed(query?: PlatformActivityFeedQuery) {
    return firstValueFrom(
      this.apiClient.get<PlatformActivityFeedResponseDto>(this.buildPath('/activity-feed', query)),
    );
  }

  getExecutiveSignals(query?: PlatformExecutiveSignalsQuery) {
    return firstValueFrom(
      this.apiClient.get<PlatformExecutiveSignalsDto>(this.buildPath('/executive-signals', query)),
    );
  }

  private buildPath(path: string, params?: object) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries((params ?? {}) as Record<string, string | number | boolean | undefined>)) {
      if (value === undefined || value === null || `${value}`.trim().length === 0) {
        continue;
      }

      query.set(key, `${value}`);
    }

    const queryString = query.toString();
    return queryString.length > 0
      ? `${this.basePath}${path}?${queryString}`
      : `${this.basePath}${path}`;
  }
}
