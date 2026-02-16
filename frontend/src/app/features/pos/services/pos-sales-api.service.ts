import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CreateSaleRequestDto,
  DailySummaryDto,
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
      this.http.post<SaleVoidResponseDto>(`${this.baseUrl}/v1/pos/sales/${saleId}/void`, payload, {
        headers: new HttpHeaders({
          'X-Correlation-Id': correlationId,
        }),
      }),
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
}
