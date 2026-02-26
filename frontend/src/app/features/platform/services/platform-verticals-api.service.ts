import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../../core/services/api-client';
import { PlatformVerticalDto, UpsertPlatformVerticalRequest } from '../models/platform.models';

@Injectable({ providedIn: 'root' })
export class PlatformVerticalsApiService {
  private readonly apiClient = inject(ApiClient);
  private readonly basePath = '/v1/platform/verticals';

  listVerticals() {
    return firstValueFrom(this.apiClient.get<PlatformVerticalDto[]>(this.basePath));
  }

  createVertical(payload: UpsertPlatformVerticalRequest) {
    return firstValueFrom(this.apiClient.post<PlatformVerticalDto>(this.basePath, payload));
  }

  updateVertical(id: string, payload: UpsertPlatformVerticalRequest) {
    return firstValueFrom(this.apiClient.put<PlatformVerticalDto>(`${this.basePath}/${id}`, payload));
  }

  deleteVertical(id: string) {
    return firstValueFrom(this.apiClient.delete<void>(`${this.basePath}/${id}`));
  }
}
