import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../../../core/services/api-client';
import {
  CatalogItemType,
  CatalogInventoryItemDto,
  CreateInventoryAdjustmentV2Request,
  CreateInventoryBatchAdjustmentV2Request,
  InventoryAdjustmentV2ResultDto,
  InventoryBatchAdjustmentV2ResultDto,
  InventoryBatchValidationResultDto,
  InventoryBalancesQuery,
  InventoryMovementsQuery,
  PagedInventoryBalancesDto,
  PagedInventoryMovementsDto,
  PosInventorySettingsDto,
  StoreInventoryItemDto,
  UpsertCatalogInventoryRequest,
  UpsertStoreInventoryRequest,
} from '../models/pos-catalog.models';

@Injectable({ providedIn: 'root' })
export class PosInventoryAdminApiService {
  private readonly apiClient = inject(ApiClient);
  private readonly releaseCPath = '/v1/pos/admin/catalog/inventory';
  private readonly legacyPath = '/v1/pos/admin/inventory';

  listInventory(storeId: string, itemType?: CatalogItemType, itemId?: string, onlyTracked?: boolean) {
    const query = new URLSearchParams({ storeId });
    if (itemType?.trim()) {
      query.set('itemType', itemType.trim());
    }

    if (itemId?.trim()) {
      query.set('itemId', itemId.trim());
    }

    if (onlyTracked) {
      query.set('onlyTracked', 'true');
    }

    return firstValueFrom(this.apiClient.get<CatalogInventoryItemDto[]>(`${this.releaseCPath}?${query.toString()}`));
  }


  listInventoryV2(queryParams: InventoryBalancesQuery) {
    const query = new URLSearchParams({ storeId: queryParams.storeId });
    if (queryParams.q?.trim()) {
      query.set('q', queryParams.q.trim());
    }

    if (queryParams.categoryId?.trim()) {
      query.set('categoryId', queryParams.categoryId.trim());
    }

    if (typeof queryParams.tracked === 'boolean') {
      query.set('tracked', queryParams.tracked ? 'true' : 'false');
    }

    if (typeof queryParams.onHandMin === 'number') {
      query.set('onHandMin', `${queryParams.onHandMin}`);
    }

    if (typeof queryParams.onHandMax === 'number') {
      query.set('onHandMax', `${queryParams.onHandMax}`);
    }

    query.set('page', `${queryParams.page ?? 1}`);
    query.set('pageSize', `${queryParams.pageSize ?? 25}`);

    return firstValueFrom(this.apiClient.get<PagedInventoryBalancesDto>(`/v2/pos/inventory/balances?${query.toString()}`));
  }



  listInventoryMovementsV2(queryParams: InventoryMovementsQuery) {
    const query = new URLSearchParams({
      storeId: queryParams.storeId,
      itemType: queryParams.itemType,
      itemId: queryParams.itemId,
      page: `${queryParams.page ?? 1}`,
      pageSize: `${queryParams.pageSize ?? 25}`,
    });

    if (queryParams.from?.trim()) {
      query.set('from', queryParams.from.trim());
    }

    if (queryParams.to?.trim()) {
      query.set('to', queryParams.to.trim());
    }

    if (queryParams.reason?.trim()) {
      query.set('reason', queryParams.reason.trim());
    }

    if (queryParams.referenceType?.trim()) {
      query.set('referenceType', queryParams.referenceType.trim());
    }

    if (queryParams.referenceId?.trim()) {
      query.set('referenceId', queryParams.referenceId.trim());
    }

    if (queryParams.createdByUserId?.trim()) {
      query.set('createdByUserId', queryParams.createdByUserId.trim());
    }

    return firstValueFrom(this.apiClient.get<PagedInventoryMovementsDto>(`/v2/pos/inventory/movements?${query.toString()}`));
  }

  createInventoryAdjustmentV2(payload: CreateInventoryAdjustmentV2Request) {
    return firstValueFrom(this.apiClient.post<InventoryAdjustmentV2ResultDto>('/v2/pos/inventory/adjustments', payload));
  }

  createInventoryBatchAdjustmentV2(payload: CreateInventoryBatchAdjustmentV2Request) {
    return firstValueFrom(this.apiClient.post<InventoryBatchAdjustmentV2ResultDto>('/v2/pos/inventory/adjustments/batch', payload));
  }

  validateInventoryBatchAdjustmentV2(payload: CreateInventoryBatchAdjustmentV2Request) {
    return firstValueFrom(this.apiClient.post<InventoryBatchValidationResultDto>('/v2/pos/inventory/adjustments/batch/validate', payload));
  }

  buildInventoryBalancesExportPath(queryParams: InventoryBalancesQuery) {
    const query = new URLSearchParams({ storeId: queryParams.storeId });
    if (queryParams.q?.trim()) {
      query.set('q', queryParams.q.trim());
    }

    if (queryParams.categoryId?.trim()) {
      query.set('categoryId', queryParams.categoryId.trim());
    }

    if (typeof queryParams.tracked === 'boolean') {
      query.set('tracked', queryParams.tracked ? 'true' : 'false');
    }

    if (typeof queryParams.onHandMin === 'number') {
      query.set('onHandMin', `${queryParams.onHandMin}`);
    }

    if (typeof queryParams.onHandMax === 'number') {
      query.set('onHandMax', `${queryParams.onHandMax}`);
    }

    return `/v2/pos/inventory/balances/export?${query.toString()}`;
  }

  exportInventoryBalancesV2(queryParams: InventoryBalancesQuery) {
    const path = this.buildInventoryBalancesExportPath(queryParams);
    return firstValueFrom(this.apiClient.getBlob(path));
  }

  upsertInventory(payload: UpsertCatalogInventoryRequest) {
    return firstValueFrom(this.apiClient.put<CatalogInventoryItemDto>(this.releaseCPath, payload));
  }

  listLegacyInventory(storeId: string, search?: string, onlyWithStock?: boolean) {
    const query = new URLSearchParams({ storeId });
    if (search?.trim()) {
      query.set('search', search.trim());
    }

    if (onlyWithStock) {
      query.set('onlyWithStock', 'true');
    }

    return firstValueFrom(this.apiClient.get<StoreInventoryItemDto[]>(`${this.legacyPath}?${query.toString()}`));
  }

  upsertLegacyInventory(payload: UpsertStoreInventoryRequest) {
    return firstValueFrom(this.apiClient.put<StoreInventoryItemDto>(this.legacyPath, payload));
  }

  updateInventorySettings(payload: PosInventorySettingsDto) {
    return firstValueFrom(this.apiClient.put<PosInventorySettingsDto>(`${this.legacyPath}/settings`, payload));
  }
}
