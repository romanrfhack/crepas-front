import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CloseShiftRequestDto,
  CloseShiftResultDto,
  CountedDenominationDto,
  OpenShiftRequestDto,
  PosShiftDto,
  ShiftClosePreviewDto,
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

  getClosePreview() {
    return firstValueFrom(this.http.get<ShiftClosePreviewDto>(`${this.baseUrl}/close-preview`));
  }

  openShift(startingCashAmount: number, notes?: string | null) {
    const payload: OpenShiftRequestDto = {
      startingCashAmount,
      notes: notes?.trim() ? notes.trim() : null,
    };

    return firstValueFrom(this.http.post<PosShiftDto>(`${this.baseUrl}/open`, payload));
  }

  closeShift(countedDenominations: CountedDenominationDto[], closingNotes: string | null) {
    const payload: CloseShiftRequestDto = {
      countedDenominations,
      closingNotes: closingNotes?.trim() ? closingNotes.trim() : null,
      clientOperationId: crypto.randomUUID(),
    };

    return firstValueFrom(this.http.post<CloseShiftResultDto>(`${this.baseUrl}/close`, payload));
  }

  private parseCurrentShiftResponse(response: HttpResponse<PosShiftDto>) {
    if (response.status === 204) {
      return null;
    }

    return response.body;
  }
}
