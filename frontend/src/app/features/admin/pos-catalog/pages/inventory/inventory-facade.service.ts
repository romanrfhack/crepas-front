import { Injectable, inject, signal } from '@angular/core';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import {
  InventoryBalanceRowDto,
  InventoryBalancesQuery,
  InventoryMovementRowDto,
  InventoryAdjustmentReasonValue,
  InventoryMovementsQuery,
  PagedInventoryBalancesDto,
  PagedInventoryMovementsDto,
} from '../../models/pos-catalog.models';
import { PosInventoryAdminApiService } from '../../services/pos-inventory-admin-api.service';

interface InventoryV2Filters {
  storeId: string;
  q: string;
  tracked: '' | 'true' | 'false';
  categoryId: string;
  onHandMin: number | null;
  onHandMax: number | null;
  page: number;
  pageSize: number;
}

interface InventoryMovementsFilters {
  from: string;
  to: string;
  reason: '' | InventoryAdjustmentReasonValue;
  referenceId: string;
  page: number;
  pageSize: number;
}

interface InventoryMovementsContext {
  storeId: string;
  itemType: 'Product' | 'Extra';
  itemId: string;
  itemName: string;
  itemSku?: string | null;
  onHandQty: number;
}

@Injectable({ providedIn: 'root' })
export class InventoryFacadeService {
  private readonly api = inject(PosInventoryAdminApiService);
  private readonly searchChanges = new Subject<string>();
  private readonly movementFilterChanges = new Subject<void>();

  readonly rows = signal<InventoryBalanceRowDto[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly filters = signal<InventoryV2Filters>({
    storeId: '',
    q: '',
    tracked: '',
    categoryId: '',
    onHandMin: null,
    onHandMax: null,
    page: 1,
    pageSize: 25,
  });

  readonly movementsOpen = signal(false);
  readonly movementsContext = signal<InventoryMovementsContext | null>(null);
  readonly movementsFilters = signal<InventoryMovementsFilters>({
    from: '',
    to: '',
    reason: '',
    referenceId: '',
    page: 1,
    pageSize: 10,
  });
  readonly movementsRows = signal<InventoryMovementRowDto[]>([]);
  readonly movementsTotalCount = signal(0);
  readonly movementsLoading = signal(false);
  readonly movementsError = signal<string | null>(null);

  private readonly cache = new Map<string, PagedInventoryBalancesDto>();
  private readonly maxCacheEntries = 50;
  private readonly movementsCache = new Map<string, PagedInventoryMovementsDto>();

  constructor() {
    this.searchChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe((term) => {
      this.filters.update((state) => ({ ...state, q: term, page: 1 }));
      void this.load();
    });

    this.movementFilterChanges.pipe(debounceTime(300)).subscribe(() => {
      this.movementsFilters.update((state) => ({ ...state, page: 1 }));
      void this.loadMovements();
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

  updateOnHandRange(onHandMin: number | null, onHandMax: number | null) {
    this.filters.update((state) => ({ ...state, onHandMin, onHandMax, page: 1 }));
  }

  updatePageSize(pageSize: number) {
    this.filters.update((state) => ({ ...state, pageSize: Math.max(1, pageSize), page: 1 }));
  }

  invalidate() {
    this.cache.clear();
    this.movementsCache.clear();
  }

  patchRow(itemType: string, itemId: string, onHandQty: number, balanceVersion: string) {
    this.rows.update((rows) => rows.map((row) => row.itemType === itemType && row.itemId === itemId ? { ...row, onHandQty, balanceVersion } : row));
    const context = this.movementsContext();
    if (context && context.itemType === itemType && context.itemId === itemId) {
      this.movementsContext.set({ ...context, onHandQty });
      this.movementsCache.clear();
      void this.loadMovements();
    }
  }

  openMovementsDrawer(context: InventoryMovementsContext) {
    this.movementsOpen.set(true);
    this.movementsContext.set(context);
    this.movementsFilters.set({
      from: '',
      to: '',
      reason: '',
      referenceId: '',
      page: 1,
      pageSize: 10,
    });
    void this.loadMovements();
  }

  closeMovementsDrawer() {
    this.movementsOpen.set(false);
    this.movementsContext.set(null);
    this.movementsRows.set([]);
    this.movementsTotalCount.set(0);
    this.movementsError.set(null);
  }

  updateMovementsFrom(from: string) {
    this.movementsFilters.update((state) => ({ ...state, from: from.trim() }));
    this.movementFilterChanges.next();
  }

  updateMovementsTo(to: string) {
    this.movementsFilters.update((state) => ({ ...state, to: to.trim() }));
    this.movementFilterChanges.next();
  }

  updateMovementsReason(reason: '' | InventoryAdjustmentReasonValue) {
    this.movementsFilters.update((state) => ({ ...state, reason }));
    this.movementFilterChanges.next();
  }

  updateMovementsReference(referenceId: string) {
    this.movementsFilters.update((state) => ({ ...state, referenceId: referenceId.trim() }));
    this.movementFilterChanges.next();
  }

  updateMovementsPage(page: number) {
    this.movementsFilters.update((state) => ({ ...state, page: Math.max(page, 1) }));
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
      onHandMin: filters.onHandMin ?? undefined,
      onHandMax: filters.onHandMax ?? undefined,
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
      if (this.cache.size > this.maxCacheEntries) {
        const first = this.cache.keys().next();
        if (!first.done) {
          this.cache.delete(first.value);
        }
      }
      this.rows.set(response.items);
      this.totalCount.set(response.totalCount);
    } catch {
      this.error.set('No fue posible cargar inventario. Intenta nuevamente.');
    } finally {
      this.loading.set(false);
    }
  }

  async loadMovements() {
    const context = this.movementsContext();
    if (!context) {
      this.movementsRows.set([]);
      this.movementsTotalCount.set(0);
      return;
    }

    const filters = this.movementsFilters();
    this.movementsLoading.set(true);
    this.movementsError.set(null);

    const query: InventoryMovementsQuery = {
      storeId: context.storeId,
      itemType: context.itemType,
      itemId: context.itemId,
      from: filters.from || undefined,
      to: filters.to || undefined,
      reason: filters.reason || undefined,
      referenceId: filters.referenceId || undefined,
      page: filters.page,
      pageSize: filters.pageSize,
    };

    const queryKey = JSON.stringify(query);
    const cached = this.movementsCache.get(queryKey);
    if (cached) {
      this.movementsRows.set(cached.items);
      this.movementsTotalCount.set(cached.totalCount);
      this.movementsLoading.set(false);
      return;
    }

    try {
      const response = await this.api.listInventoryMovementsV2(query);
      this.movementsCache.set(queryKey, response);
      this.movementsRows.set(response.items);
      this.movementsTotalCount.set(response.totalCount);
    } catch {
      this.movementsError.set('No fue posible cargar el kardex. Intenta nuevamente.');
    } finally {
      this.movementsLoading.set(false);
    }
  }
}
