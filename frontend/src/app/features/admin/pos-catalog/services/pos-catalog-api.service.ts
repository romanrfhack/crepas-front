import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../../../core/services/api-client';
import {
  CategoryDto,
  ExtraDto,
  IncludedItemDto,
  OptionItemDto,
  OptionSetDto,
  OverrideUpsertRequest,
  ProductDto,
  ProductOverrideDto,
  ReplaceIncludedItemsRequest,
  SchemaDto,
  SelectionGroupDto,
  UpsertCategoryRequest,
  UpsertExtraRequest,
  UpsertOptionItemRequest,
  UpsertOptionSetRequest,
  UpsertProductRequest,
  UpsertSchemaRequest,
  UpsertSelectionGroupRequest,
} from '../models/pos-catalog.models';

@Injectable({ providedIn: 'root' })
export class PosCatalogApiService {
  private readonly apiClient = inject(ApiClient);
  private readonly basePath = '/v1/pos/admin';

  getCategories(includeInactive = true) {
    return firstValueFrom(
      this.apiClient.get<CategoryDto[]>(`${this.basePath}/categories?includeInactive=${includeInactive}`),
    );
  }

  createCategory(payload: UpsertCategoryRequest) {
    return firstValueFrom(this.apiClient.post<CategoryDto>(`${this.basePath}/categories`, payload));
  }

  updateCategory(id: string, payload: UpsertCategoryRequest) {
    return firstValueFrom(this.apiClient.put<CategoryDto>(`${this.basePath}/categories/${id}`, payload));
  }

  deactivateCategory(id: string) {
    return firstValueFrom(this.apiClient.delete<void>(`${this.basePath}/categories/${id}`));
  }

  getProducts(includeInactive = true) {
    return firstValueFrom(
      this.apiClient.get<ProductDto[]>(`${this.basePath}/products?includeInactive=${includeInactive}`),
    );
  }

  createProduct(payload: UpsertProductRequest) {
    return firstValueFrom(this.apiClient.post<ProductDto>(`${this.basePath}/products`, payload));
  }

  updateProduct(id: string, payload: UpsertProductRequest) {
    return firstValueFrom(this.apiClient.put<ProductDto>(`${this.basePath}/products/${id}`, payload));
  }

  deactivateProduct(id: string) {
    return firstValueFrom(this.apiClient.delete<void>(`${this.basePath}/products/${id}`));
  }

  getOptionSets(includeInactive = true) {
    return firstValueFrom(
      this.apiClient.get<OptionSetDto[]>(`${this.basePath}/option-sets?includeInactive=${includeInactive}`),
    );
  }

  createOptionSet(payload: UpsertOptionSetRequest) {
    return firstValueFrom(this.apiClient.post<OptionSetDto>(`${this.basePath}/option-sets`, payload));
  }

  updateOptionSet(id: string, payload: UpsertOptionSetRequest) {
    return firstValueFrom(this.apiClient.put<OptionSetDto>(`${this.basePath}/option-sets/${id}`, payload));
  }

  deactivateOptionSet(id: string) {
    return firstValueFrom(this.apiClient.delete<void>(`${this.basePath}/option-sets/${id}`));
  }

  getOptionItems(optionSetId: string, includeInactive = true) {
    return firstValueFrom(
      this.apiClient.get<OptionItemDto[]>(
        `${this.basePath}/option-sets/${optionSetId}/items?includeInactive=${includeInactive}`,
      ),
    );
  }

  createOptionItem(optionSetId: string, payload: UpsertOptionItemRequest) {
    return firstValueFrom(
      this.apiClient.post<OptionItemDto>(`${this.basePath}/option-sets/${optionSetId}/items`, payload),
    );
  }

  updateOptionItem(optionSetId: string, itemId: string, payload: UpsertOptionItemRequest) {
    return firstValueFrom(
      this.apiClient.put<OptionItemDto>(
        `${this.basePath}/option-sets/${optionSetId}/items/${itemId}`,
        payload,
      ),
    );
  }

  deactivateOptionItem(optionSetId: string, itemId: string) {
    return firstValueFrom(
      this.apiClient.delete<void>(`${this.basePath}/option-sets/${optionSetId}/items/${itemId}`),
    );
  }

  getSchemas(includeInactive = true) {
    return firstValueFrom(
      this.apiClient.get<SchemaDto[]>(`${this.basePath}/schemas?includeInactive=${includeInactive}`),
    );
  }

  createSchema(payload: UpsertSchemaRequest) {
    return firstValueFrom(this.apiClient.post<SchemaDto>(`${this.basePath}/schemas`, payload));
  }

  updateSchema(id: string, payload: UpsertSchemaRequest) {
    return firstValueFrom(this.apiClient.put<SchemaDto>(`${this.basePath}/schemas/${id}`, payload));
  }

  deactivateSchema(id: string) {
    return firstValueFrom(this.apiClient.delete<void>(`${this.basePath}/schemas/${id}`));
  }

  getGroups(schemaId: string, includeInactive = true) {
    return firstValueFrom(
      this.apiClient.get<SelectionGroupDto[]>(
        `${this.basePath}/schemas/${schemaId}/groups?includeInactive=${includeInactive}`,
      ),
    );
  }

  createGroup(schemaId: string, payload: UpsertSelectionGroupRequest) {
    return firstValueFrom(
      this.apiClient.post<SelectionGroupDto>(`${this.basePath}/schemas/${schemaId}/groups`, payload),
    );
  }

  updateGroup(schemaId: string, groupId: string, payload: UpsertSelectionGroupRequest) {
    return firstValueFrom(
      this.apiClient.put<SelectionGroupDto>(`${this.basePath}/schemas/${schemaId}/groups/${groupId}`, payload),
    );
  }

  deactivateGroup(schemaId: string, groupId: string) {
    return firstValueFrom(
      this.apiClient.delete<void>(`${this.basePath}/schemas/${schemaId}/groups/${groupId}`),
    );
  }

  getExtras(includeInactive = true) {
    return firstValueFrom(
      this.apiClient.get<ExtraDto[]>(`${this.basePath}/extras?includeInactive=${includeInactive}`),
    );
  }

  createExtra(payload: UpsertExtraRequest) {
    return firstValueFrom(this.apiClient.post<ExtraDto>(`${this.basePath}/extras`, payload));
  }

  updateExtra(id: string, payload: UpsertExtraRequest) {
    return firstValueFrom(this.apiClient.put<ExtraDto>(`${this.basePath}/extras/${id}`, payload));
  }

  deactivateExtra(id: string) {
    return firstValueFrom(this.apiClient.delete<void>(`${this.basePath}/extras/${id}`));
  }

  getIncludedItems(productId: string) {
    return firstValueFrom(
      this.apiClient.get<IncludedItemDto[]>(`${this.basePath}/products/${productId}/included-items`),
    );
  }

  replaceIncludedItems(productId: string, payload: ReplaceIncludedItemsRequest) {
    return firstValueFrom(
      this.apiClient.put<IncludedItemDto[]>(`${this.basePath}/products/${productId}/included-items`, payload),
    );
  }

  upsertOverride(productId: string, groupKey: string, payload: OverrideUpsertRequest) {
    return firstValueFrom(
      this.apiClient.put<ProductOverrideDto>(
        `${this.basePath}/products/${productId}/overrides/${encodeURIComponent(groupKey)}`,
        payload,
      ),
    );
  }
}
