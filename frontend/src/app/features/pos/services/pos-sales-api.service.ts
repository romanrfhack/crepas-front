import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CreateSaleRequestDto,
  DailySummaryDto,
  SaleDetailDto,
  SaleListItemUi,
  SaleVoidRequestDto,
  SaleVoidResponseDto,
  SaleResponseDto,
  TopProductDto,
} from '../models/pos.models';

@Injectable({ providedIn: 'root' })
export class PosSalesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  createSale(payload: CreateSaleRequestDto, correlationId: string) {
    return firstValueFrom(
      this.http.post<SaleResponseDto>(`${this.baseUrl}/v1/pos/sales`, payload, {
        headers: new HttpHeaders({
          'X-Correlation-Id': correlationId,
        }),
      }),
    );
  }

  voidSale(saleId: string, payload: SaleVoidRequestDto, correlationId: string) {
    return firstValueFrom(
      this.http
        .post<SaleVoidResponseDto>(`${this.baseUrl}/v1/pos/sales/${saleId}/void`, payload, {
          headers: new HttpHeaders({
            'X-Correlation-Id': correlationId,
          }),
          observe: 'response',
        })
        .pipe(
          map((response) => {
            if (!response.body) {
              throw new Error('Void sale response body is empty');
            }

            return response.body;
          }),
        ),
    );
  }

  getDailySummary(date: string) {
    return firstValueFrom(
      this.http.get<DailySummaryDto>(`${this.baseUrl}/v1/pos/reports/daily-summary?date=${date}`),
    );
  }

  getTopProducts(dateFrom: string, dateTo: string, top = 10) {
    return firstValueFrom(
      this.http.get<TopProductDto[]>(
        `${this.baseUrl}/v1/pos/reports/top-products?dateFrom=${dateFrom}&dateTo=${dateTo}&top=${top}`,
      ),
    );
  }

  listSales(options?: {
    page?: number;
    pageSize?: number;
    q?: string;
    from?: string;
    to?: string;
    storeId?: string;
  }) {
    const { page = 1, pageSize = 20, q, from, to, storeId } = options ?? {};
    const query = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      ...(q ? { q } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(storeId ? { storeId } : {}),
    }).toString();

    return firstValueFrom(
      this.http.get<{ total: number; items: SaleListItemUi[] }>(
        `${this.baseUrl}/v1/pos/sales?${query}`,
      ),
    );
  }

  getSaleDetail(saleId: string) {
    return firstValueFrom(this.http.get<SaleDetailDto>(`${this.baseUrl}/v1/pos/sales/${saleId}`));
  }
}
