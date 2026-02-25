import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../../../core/services/api-client';
import {
  CatalogInventoryAdjustmentDto,
  CatalogItemType,
  CreateCatalogInventoryAdjustmentRequest,
  InventoryAdjustmentReason,
} from '../models/pos-catalog.models';

interface ListCatalogInventoryAdjustmentsQuery {
  storeId: string;
  itemType?: Extract<CatalogItemType, 'Product' | 'Extra'>;
  itemId?: string;
  fromUtc?: string;
  toUtc?: string;
  reason?: InventoryAdjustmentReason;
}

@Injectable({ providedIn: 'root' })
export class PosInventoryAdjustmentsApiService {
  private readonly apiClient = inject(ApiClient);
  private readonly basePath = '/v1/pos/admin/catalog/inventory/adjustments';

  createAdjustment(req: CreateCatalogInventoryAdjustmentRequest) {
    return firstValueFrom(this.apiClient.post<CatalogInventoryAdjustmentDto>(this.basePath, req));
  }

  listAdjustments(query: ListCatalogInventoryAdjustmentsQuery) {
    const queryParams = new URLSearchParams({ storeId: query.storeId });

    if (query.itemType?.trim()) {
      queryParams.set('itemType', query.itemType.trim());
    }

    if (query.itemId?.trim()) {
      queryParams.set('itemId', query.itemId.trim());
    }

    if (query.fromUtc?.trim()) {
      queryParams.set('fromUtc', query.fromUtc.trim());
    }

    if (query.toUtc?.trim()) {
      queryParams.set('toUtc', query.toUtc.trim());
    }

    if (query.reason?.trim()) {
      queryParams.set('reason', query.reason.trim());
    }

    return firstValueFrom(
      this.apiClient.get<CatalogInventoryAdjustmentDto[]>(`${this.basePath}?${queryParams.toString()}`),
    );
  }
}

export type { ListCatalogInventoryAdjustmentsQuery };
