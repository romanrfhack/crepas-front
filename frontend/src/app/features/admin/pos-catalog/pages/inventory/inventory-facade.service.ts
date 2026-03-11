import { Injectable, inject, signal } from '@angular/core';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import {
  InventoryBalanceRowDto,
  InventoryBalancesQuery,
  PagedInventoryBalancesDto,
} from '../../models/pos-catalog.models';
import { PosInventoryAdminApiService } from '../../services/pos-inventory-admin-api.service';

interface InventoryV2Filters {
  storeId: string;
  q: string;
  tracked: '' | 'true' | 'false';
  categoryId: string;
  page: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class InventoryFacadeService {
  private readonly api = inject(PosInventoryAdminApiService);
  private readonly searchChanges = new Subject<string>();

  readonly rows = signal<InventoryBalanceRowDto[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly filters = signal<InventoryV2Filters>({
    storeId: '',
    q: '',
    tracked: '',
    categoryId: '',
    page: 1,
    pageSize: 10,
  });

  private readonly cache = new Map<string, PagedInventoryBalancesDto>();

  constructor() {
    this.searchChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe((term) => {
      this.filters.update((state) => ({ ...state, q: term, page: 1 }));
      void this.load();
    });
  }

  updateStore(storeId: string) {
    this.filters.update((state) => ({ ...state, storeId, page: 1 }));
    this.cache.clear();
  }

  updateSearch(term: string) {
    this.searchChanges.next(term.trim());
  }

  updateTracked(value: '' | 'true' | 'false') {
    this.filters.update((state) => ({ ...state, tracked: value, page: 1 }));
  }

  updateCategory(categoryId: string) {
    this.filters.update((state) => ({ ...state, categoryId: categoryId.trim(), page: 1 }));
  }

  updatePage(page: number) {
    this.filters.update((state) => ({ ...state, page: Math.max(page, 1) }));
  }



  invalidate() {
    this.cache.clear();
  }

  patchRow(itemType: string, itemId: string, onHandQty: number, balanceVersion: string) {
    this.rows.update((rows) => rows.map((row) => row.itemType === itemType && row.itemId === itemId ? { ...row, onHandQty, balanceVersion } : row));
  }

  async load() {
    const filters = this.filters();
    if (!filters.storeId) {
      this.rows.set([]);
      this.totalCount.set(0);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const query: InventoryBalancesQuery = {
      storeId: filters.storeId,
      q: filters.q || undefined,
      categoryId: filters.categoryId || undefined,
      tracked: filters.tracked === '' ? undefined : filters.tracked === 'true',
      page: filters.page,
      pageSize: filters.pageSize,
    };

    const queryKey = JSON.stringify(query);
    const cached = this.cache.get(queryKey);
    if (cached) {
      this.rows.set(cached.items);
      this.totalCount.set(cached.totalCount);
      this.loading.set(false);
      return;
    }

    try {
      const response = await this.api.listInventoryV2(query);
      this.cache.set(queryKey, response);
      this.rows.set(response.items);
      this.totalCount.set(response.totalCount);
    } catch {
      this.error.set('No fue posible cargar inventario. Intenta nuevamente.');
    } finally {
      this.loading.set(false);
    }
  }
}
