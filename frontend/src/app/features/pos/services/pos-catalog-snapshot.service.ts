import { HttpClient, HttpErrorResponse, HttpHeaders, HttpResponse } from '@angular/common/http';
import { effect, inject, Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { CatalogSnapshotDto } from '../models/pos.models';
import { StoreContextService } from './store-context.service';

interface SnapshotCacheRecord {
  etag: string;
  snapshot: CatalogSnapshotDto;
}

interface SnapshotRequest {
  storeId?: string;
  forceRefresh?: boolean;
}

@Injectable({ providedIn: 'root' })
export class PosCatalogSnapshotService {
  private readonly http = inject(HttpClient);
  private readonly storeContext = inject(StoreContextService);
  private readonly path = '/v1/pos/catalog/snapshot';
  private readonly cachePrefix = 'pos_catalog_snapshot_cache';
  private readonly snapshotState = signal<CatalogSnapshotDto | null>(null);
  private previousStoreId: string | null;

  readonly snapshot = this.snapshotState.asReadonly();

  constructor() {
    this.previousStoreId = this.normalizeStoreId(this.storeContext.activeStoreId());

    effect(() => {
      const activeStoreId = this.normalizeStoreId(this.storeContext.activeStoreId());
      if (activeStoreId === this.previousStoreId) {
        return;
      }

      if (this.previousStoreId !== null) {
        localStorage.removeItem(this.getScopedCacheKey(this.previousStoreId));
      }

      this.snapshotState.set(null);
      this.previousStoreId = activeStoreId;
    });
  }

  getSnapshot(request: SnapshotRequest = {}): Observable<CatalogSnapshotDto> {
    const storeId = this.resolveStoreId(request.storeId);
    const scopedCacheKey = this.getScopedCacheKey(storeId);
    const cached = this.readCache(scopedCacheKey);
    const headers = this.buildHeaders(cached?.etag, request.forceRefresh === true);
    const url = this.buildUrl(storeId);

    return this.http.get<CatalogSnapshotDto>(url, { observe: 'response', headers }).pipe(
      map((response) => this.handleSnapshotResponse(scopedCacheKey, response, cached)),
      catchError((error: unknown) => {
        if (this.isNotModifiedError(error) && cached) {
          this.setSnapshotSignal(cached.snapshot);
          return of(cached.snapshot);
        }

        throw error;
      }),
    );
  }

  invalidate(storeId?: string) {
    const resolvedStoreId = this.resolveStoreId(storeId);
    const scopedCacheKey = this.getScopedCacheKey(resolvedStoreId);
    localStorage.removeItem(scopedCacheKey);
    if (!storeId && !resolvedStoreId) {
      localStorage.removeItem(this.getScopedCacheKey(null));
    }
  }

  private handleSnapshotResponse(
    cacheKey: string,
    response: HttpResponse<CatalogSnapshotDto>,
    cached: SnapshotCacheRecord | null,
  ): CatalogSnapshotDto {
    if (response.status === 304 && cached) {
      this.setSnapshotSignal(cached.snapshot);
      return cached.snapshot;
    }

    const snapshot = response.body;
    if (!snapshot) {
      if (cached) {
        this.setSnapshotSignal(cached.snapshot);
        return cached.snapshot;
      }
      throw new Error('Snapshot response body is empty.');
    }

    const etag = response.headers.get('ETag') ?? cached?.etag;
    if (etag) {
      this.writeCache(cacheKey, { etag, snapshot });
    }

    this.setSnapshotSignal(snapshot);
    return snapshot;
  }

  private setSnapshotSignal(snapshot: CatalogSnapshotDto) {
    this.snapshotState.set(snapshot);
  }

  private buildHeaders(etag: string | undefined, forceRefresh: boolean): HttpHeaders {
    if (forceRefresh || !etag) {
      return new HttpHeaders();
    }

    return new HttpHeaders({ 'If-None-Match': etag });
  }

  private resolveStoreId(explicitStoreId?: string): string | null {
    const normalizedExplicitStoreId = this.normalizeStoreId(explicitStoreId);
    if (normalizedExplicitStoreId) {
      return normalizedExplicitStoreId;
    }

    return this.normalizeStoreId(this.storeContext.getActiveStoreId());
  }

  private normalizeStoreId(storeId: string | null | undefined): string | null {
    const normalizedStoreId = storeId?.trim();
    return normalizedStoreId ? normalizedStoreId : null;
  }

  private buildUrl(storeId: string | null): string {
    const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : '';
    return `${environment.apiBaseUrl}${this.path}${query}`;
  }

  private getScopedCacheKey(storeId: string | null): string {
    return storeId ? `${this.cachePrefix}:${storeId}` : `${this.cachePrefix}:default`;
  }

  private readCache(cacheKey: string): SnapshotCacheRecord | null {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as SnapshotCacheRecord;
    } catch {
      localStorage.removeItem(cacheKey);
      return null;
    }
  }

  private writeCache(cacheKey: string, record: SnapshotCacheRecord) {
    localStorage.setItem(cacheKey, JSON.stringify(record));
  }

  private isNotModifiedError(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status === 304;
  }
}
