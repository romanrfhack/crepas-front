import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PlatformTenantStoreListItemDto } from '../../models/platform.models';
import { PlatformStoresApiService } from '../../services/platform-stores-api.service';

@Component({
  selector: 'app-platform-tenant-stores-page',
  template: `
    <section data-testid="platform-tenant-stores-page">
      <h2>Stores del tenant</h2>

      @if (success()) {
        <p data-testid="platform-tenant-stores-success">{{ success() }}</p>
      }
      @if (error()) {
        <p data-testid="platform-tenant-stores-error">{{ error() }}</p>
      }

      @if (loading()) {
        <p>Cargando...</p>
      } @else {
        @if (showWithoutAdminOnly()) {
          <p
            data-testid="platform-tenant-stores-context-without-admin"
            class="filter-chip"
          >
            Mostrando solo stores sin AdminStore.
          </p>
          <p data-testid="platform-tenant-stores-context-badge" class="context-badge">
            Contexto activo: resolución de stores sin AdminStore.
          </p>
        }
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>TimeZone</th>
              <th>Estado</th>
              <th>AdminStore</th>
              <th>AdminStore users</th>
              <th>Total users</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (store of visibleStores(); track store.id) {
              <tr [attr.data-testid]="'platform-tenant-stores-row-' + store.id" [class.highlight-row]="store.isDefaultStore || !store.hasAdminStore">
                <td>
                  <strong>{{ store.name }}</strong>
                  <div class="secondary-info">{{ store.id }}</div>
                </td>
                <td>{{ store.timeZoneId }}</td>
                <td [attr.data-testid]="'platform-tenant-stores-default-' + store.id">
                  <span class="chip" [class.chip-default]="store.isDefaultStore">
                    {{ store.isDefaultStore ? 'Principal' : 'Regular' }}
                  </span>
                </td>
                <td [attr.data-testid]="'platform-tenant-stores-has-admin-' + store.id">
                  <span class="chip" [class.chip-warning]="!store.hasAdminStore">
                    {{ store.hasAdminStore ? 'Con AdminStore' : 'Sin AdminStore' }}
                  </span>
                </td>
                <td>{{ store.adminStoreUserCount }}</td>
                <td>{{ store.totalUsersInStore }}</td>
                <td class="actions-cell">
                  @if (!store.hasAdminStore) {
                    <button
                      type="button"
                      [attr.data-testid]="'platform-tenant-stores-create-adminstore-' + store.id"
                      (click)="createAdminStore(store)"
                    >
                      Crear AdminStore
                    </button>
                  }

                  <button
                    type="button"
                    [attr.data-testid]="'platform-tenant-stores-view-details-' + store.id"
                    (click)="openDetails(store.id)"
                  >
                    Ver detalle
                  </button>

                  @if (!store.isDefaultStore) {
                    <button
                      type="button"
                      [attr.data-testid]="'platform-tenant-stores-set-default-' + store.id"
                      [disabled]="settingDefaultStoreId() === store.id"
                      (click)="setAsDefault(store.id)"
                    >
                      Hacer principal
                    </button>
                  }

                  <button
                    type="button"
                    [attr.data-testid]="'platform-tenant-stores-users-' + store.id"
                    (click)="goToUsers(store)"
                  >
                    Ver usuarios
                  </button>

                  <button
                    type="button"
                    [attr.data-testid]="'platform-tenant-stores-dashboard-' + store.id"
                    (click)="goToDashboard(store)"
                  >
                    Ver dashboard
                  </button>

                  <button
                    type="button"
                    [attr.data-testid]="'platform-tenant-stores-inventory-' + store.id"
                    (click)="goToInventory(store)"
                  >
                    Ver inventario
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
  styles: `
    .filter-chip {
      display: inline-block;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      background: #fef3c7;
      margin-bottom: 0.7rem;
      font-weight: 600;
    }

    .context-badge {
      display: inline-block;
      margin: 0 0 0.7rem;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      background: #dbeafe;
      font-weight: 600;
    }

    .secondary-info {
      opacity: 0.75;
      font-size: 0.8rem;
    }

    .chip {
      display: inline-block;
      padding: 0.2rem 0.5rem;
      border-radius: 999px;
      background: #eef2ff;
    }

    .chip-default {
      font-weight: 700;
      background: #dbeafe;
    }

    .chip-warning {
      font-weight: 700;
      background: #fee2e2;
    }

    .highlight-row {
      background: #fafafa;
    }

    .actions-cell {
      display: grid;
      gap: 0.35rem;
      align-items: start;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantStoresPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(PlatformStoresApiService);

  readonly loading = signal(true);
  readonly stores = signal<PlatformTenantStoreListItemDto[]>([]);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly settingDefaultStoreId = signal<string | null>(null);
  readonly showWithoutAdminOnly = signal(false);
  readonly visibleStores = signal<PlatformTenantStoreListItemDto[]>([]);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    const tenantId = this.tenantId();
    if (!tenantId) {
      this.error.set('Tenant inválido.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const stores = await this.api.getTenantStores(tenantId);
      const showWithoutAdminOnly =
        this.route.snapshot.queryParamMap.get('withoutAdminStore') === 'true';
      this.showWithoutAdminOnly.set(showWithoutAdminOnly);
      this.stores.set(stores);
      this.visibleStores.set(
        showWithoutAdminOnly ? stores.filter((store) => !store.hasAdminStore) : stores,
      );
    } catch (error) {
      this.error.set(this.mapProblemDetails(error));
    } finally {
      this.loading.set(false);
    }
  }

  openDetails(storeId: string): void {
    void this.router.navigate(['/app/platform/stores', storeId]);
  }

  async setAsDefault(storeId: string): Promise<void> {
    const tenantId = this.tenantId();
    if (!tenantId) {
      return;
    }

    this.settingDefaultStoreId.set(storeId);
    this.error.set(null);
    this.success.set(null);

    try {
      await this.api.updateTenantDefaultStore(tenantId, { defaultStoreId: storeId });
      this.success.set('Sucursal principal actualizada.');
      await this.load();
    } catch (error) {
      this.error.set(this.mapProblemDetails(error));
    } finally {
      this.settingDefaultStoreId.set(null);
    }
  }

  goToUsers(store: PlatformTenantStoreListItemDto): void {
    void this.router.navigate(['/app/admin/users'], {
      queryParams: { tenantId: store.tenantId, storeId: store.id },
    });
  }


  goToDashboard(store: PlatformTenantStoreListItemDto): void {
    void this.router.navigate(['/app/platform/dashboard'], {
      queryParams: { tenantId: store.tenantId, storeId: store.id },
    });
  }

  goToInventory(store: PlatformTenantStoreListItemDto): void {
    void this.router.navigate(['/app/admin/pos/inventory'], {
      queryParams: { tenantId: store.tenantId, storeId: store.id },
    });
  }

  createAdminStore(store: PlatformTenantStoreListItemDto): void {
    void this.router.navigate(['/app/admin/users'], {
      queryParams: {
        tenantId: store.tenantId,
        storeId: store.id,
        intent: 'create-user',
        suggestedRole: 'AdminStore',
      },
    });
  }

  private tenantId(): string | null {
    return this.route.snapshot.paramMap.get('tenantId');
  }

  private mapProblemDetails(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'No se pudo completar la acción.';
    }

    const payload = error.error as
      | { detail?: string; title?: string; errors?: Record<string, string[] | undefined> }
      | null
      | undefined;

    if (payload?.detail) {
      return payload.detail;
    }

    const firstValidation = payload?.errors
      ? Object.values(payload.errors)
          .flat()
          .find((item): item is string => typeof item === 'string')
      : null;

    return firstValidation ?? payload?.title ?? 'No se pudo completar la acción.';
  }
}
