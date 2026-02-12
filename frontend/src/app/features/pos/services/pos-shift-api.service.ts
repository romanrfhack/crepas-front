import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CashCountLineDto,
  CloseShiftRequestDto,
  OpenShiftRequestDto,
  PosShiftDto,
} from '../models/pos.models';

@Injectable({ providedIn: 'root' })
export class PosShiftApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/v1/pos/shifts`;

  async getCurrentShift() {
    const response = await firstValueFrom(
      this.http.get<PosShiftDto>(`${this.baseUrl}/current`, { observe: 'response' }),
    );

    return this.parseCurrentShiftResponse(response);
  }

  openShift(startingCashAmount: number, notes?: string | null) {
    const payload: OpenShiftRequestDto = {
      startingCashAmount,
      notes: notes?.trim() ? notes.trim() : null,
    };

    return firstValueFrom(this.http.post<PosShiftDto>(`${this.baseUrl}/open`, payload));
  }

  closeShift(
    shiftId: string,
    cashCountLines: CashCountLineDto[],
    reason: string | null,
    evidence?: string | null,
  ) {
    const payload: CloseShiftRequestDto = {
      shiftId,
      cashCountLines,
      reason: reason?.trim() ? reason.trim() : null,
      evidence: evidence?.trim() ? evidence.trim() : null,
    };

    return firstValueFrom(this.http.post<PosShiftDto>(`${this.baseUrl}/close`, payload));
  }

  private parseCurrentShiftResponse(response: HttpResponse<PosShiftDto>) {
    if (response.status === 204) {
      return null;
    }

    return response.body;
  }
}
