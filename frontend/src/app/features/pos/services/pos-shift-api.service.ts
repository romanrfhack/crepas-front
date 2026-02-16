import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CloseShiftRequestDto,
  CloseShiftResultDto,
  OpenShiftRequestDto,
  PosShiftDto,
  ShiftClosePreviewRequestDto,
  ShiftClosePreviewDto,
} from '../models/pos.models';
import { StoreContextService } from './store-context.service';

@Injectable({ providedIn: 'root' })
export class PosShiftApiService {
  private readonly http = inject(HttpClient);
  private readonly storeContext = inject(StoreContextService);
  private readonly baseUrl = `${environment.apiBaseUrl}/v1/pos/shifts`;

  async getCurrentShift() {
    const storeId = this.storeContext.getActiveStoreId();
    const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : '';
    const response = await firstValueFrom(
      this.http.get<PosShiftDto>(`${this.baseUrl}/current${query}`, { observe: 'response' }),
    );

    return this.parseCurrentShiftResponse(response);
  }

  getClosePreview() {
    const storeId = this.storeContext.getActiveStoreId();
    const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : '';
    return firstValueFrom(this.http.get<ShiftClosePreviewDto>(`${this.baseUrl}/close-preview${query}`));
  }

  closePreviewV2(payload: ShiftClosePreviewRequestDto) {
    const storeId = this.storeContext.getActiveStoreId();
    const requestPayload: ShiftClosePreviewRequestDto = {
      ...payload,
      ...(storeId ? { storeId } : {}),
    };

    return firstValueFrom(this.http.post<ShiftClosePreviewDto>(`${this.baseUrl}/close-preview`, requestPayload)).then(
      (preview) => this.normalizeClosePreview(preview),
    );
  }

  openShift(startingCashAmount: number, notes?: string | null) {
    const storeId = this.storeContext.getActiveStoreId();
    const payload: OpenShiftRequestDto = {
      startingCashAmount,
      notes: notes?.trim() ? notes.trim() : null,
      ...(storeId ? { storeId } : {}),
    };

    return firstValueFrom(this.http.post<PosShiftDto>(`${this.baseUrl}/open`, payload));
  }

  closeShift(payload: CloseShiftRequestDto) {
    const storeId = this.storeContext.getActiveStoreId();
    const requestPayload: CloseShiftRequestDto = {
      ...payload,
      countedDenominations: payload.countedDenominations ?? [],
      ...(storeId ? { storeId } : {}),
    };

    return firstValueFrom(this.http.post<CloseShiftResultDto>(`${this.baseUrl}/close`, requestPayload));
  }

  private parseCurrentShiftResponse(response: HttpResponse<PosShiftDto>) {
    if (response.status === 204) {
      return null;
    }

    return response.body;
  }

  private normalizeClosePreview(preview: ShiftClosePreviewDto): ShiftClosePreviewDto {
    return {
      ...preview,
      countedCashAmount: preview.countedCashAmount ?? null,
      difference: preview.difference ?? null,
      breakdown: preview.breakdown ?? {
        cashAmount: preview.salesCashTotal,
        cardAmount: 0,
        transferAmount: 0,
        totalSalesCount: 0,
      },
    };
  }
}
