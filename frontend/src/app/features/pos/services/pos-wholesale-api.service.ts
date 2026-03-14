import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../../core/services/api-client';
import {
  PosInventoryValidateAvailabilityRequestDto,
  PosInventoryValidateAvailabilityResponseDto,
  PosPricingQuoteRequestDto,
  PosPricingQuoteResponseDto,
  ProductWholesaleOverrideDto,
  TenantWholesalePolicyDto,
} from '../models/pos.models';

@Injectable({ providedIn: 'root' })
export class PosWholesaleApiService {
  private readonly apiClient = inject(ApiClient);

  getTenantWholesalePolicy() {
    return firstValueFrom(this.apiClient.get<TenantWholesalePolicyDto>('/v1/pos/wholesale/policy'));
  }

  quotePricing(payload: PosPricingQuoteRequestDto) {
    return firstValueFrom(this.apiClient.post<PosPricingQuoteResponseDto>('/v1/pos/pricing/quote', payload));
  }

  validateAvailability(payload: PosInventoryValidateAvailabilityRequestDto) {
    return firstValueFrom(
      this.apiClient.post<PosInventoryValidateAvailabilityResponseDto>(
        '/v1/pos/inventory/validate-availability',
        payload,
      ),
    );
  }

  getProductWholesaleOverride(productId: string) {
    return firstValueFrom(
      this.apiClient.get<ProductWholesaleOverrideDto>(`/v1/pos/wholesale/products/${productId}/override`),
    );
  }
}
