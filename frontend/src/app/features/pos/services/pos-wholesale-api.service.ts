import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../../core/services/api-client';
import { ProductWholesaleOverrideDto, TenantWholesalePolicyDto } from '../models/pos.models';

@Injectable({ providedIn: 'root' })
export class PosWholesaleApiService {
  private readonly apiClient = inject(ApiClient);

  getTenantWholesalePolicy() {
    return firstValueFrom(this.apiClient.get<TenantWholesalePolicyDto>('/v1/pos/wholesale/policy'));
  }

  getProductWholesaleOverride(productId: string) {
    return firstValueFrom(
      this.apiClient.get<ProductWholesaleOverrideDto>(`/v1/pos/wholesale/products/${productId}/override`),
    );
  }
}
