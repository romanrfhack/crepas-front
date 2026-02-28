import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PlatformTenantDetailsDto, PlatformVerticalDto } from '../../models/platform.models';
import { PlatformTenantsApiService } from '../../services/platform-tenants-api.service';
import { PlatformVerticalsApiService } from '../../services/platform-verticals-api.service';

type ProblemLike = {
  detail?: string;
  title?: string;
  errors?: Record<string, string[]>;
};

@Component({
  selector: 'app-tenant-details-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <section class="tenant-details-page" data-testid="platform-tenant-details-page">
      <header class="header">
        <div>
          <h2>{{ tenant()?.name ?? 'Tenant' }}</h2>
          <p>Detalle y configuración básica del tenant</p>
        </div>
        <div class="actions">
          <button
            type="button"
            class="btn-outline"
            data-testid="platform-tenant-details-action-edit"
            (click)="openEdit()"
          >
            ✏️ Editar
          </button>
          <button
            type="button"
            class="btn-outline"
            data-testid="platform-tenant-details-action-stores"
            (click)="goToStores()"
          >
            🏬 Ver stores
          </button>
          <button
            type="button"
            class="btn-outline"
            data-testid="platform-tenant-details-action-users"
            (click)="goToUsers()"
          >
            👥 Ver usuarios del tenant
          </button>
          <button
            type="button"
            class="btn-outline"
            data-testid="platform-tenant-details-action-dashboard"
            (click)="goToDashboard()"
          >
            📊 Dashboard
          </button>
          <button
            type="button"
            class="btn-outline"
            data-testid="platform-tenant-details-action-reports"
            (click)="goToReports()"
          >
            📈 Reportes
          </button>
          <button
            type="button"
            class="btn-outline"
            data-testid="platform-tenant-details-action-inventory"
            [disabled]="!canOpenInventory()"
            (click)="goToInventory()"
          >
            📦 Inventario
          </button>
        </div>
      </header>

      @if (error()) {
        <p class="alert error" data-testid="platform-tenant-edit-error">{{ error() }}</p>
      }
      @if (success()) {
        <p class="alert success" data-testid="platform-tenant-edit-success">{{ success() }}</p>
      }

      @if (tenant(); as item) {
        <section class="card">
          <h3>Identidad</h3>
          <div class="grid">
            <div>
              <strong>Name:</strong>
              <span data-testid="platform-tenant-details-name">{{ item.name }}</span>
            </div>
            <div>
              <strong>Slug:</strong>
              <span data-testid="platform-tenant-details-slug">{{ item.slug }}</span>
            </div>
            <div>
              <strong>Vertical:</strong>
              <span data-testid="platform-tenant-details-vertical">{{
                item.verticalName ?? '—'
              }}</span>
            </div>
            <div>
              <strong>Template:</strong>
              <span data-testid="platform-tenant-details-template">{{
                item.catalogTemplateName ?? 'Sin template'
              }}</span>
            </div>
            <div>
              <strong>Default store:</strong>
              <span data-testid="platform-tenant-details-default-store">{{
                item.defaultStoreName ?? 'Sin tienda por defecto'
              }}</span>
            </div>
            <div>
              <strong>Activo:</strong>
              <span data-testid="platform-tenant-details-active">{{
                item.isActive ? 'Sí' : 'No'
              }}</span>
            </div>
          </div>
        </section>

        <section class="card metrics">
          <h3>Métricas</h3>
          <div class="metrics-grid">
            <article data-testid="platform-tenant-details-metric-store-count">
              <span>Stores</span><strong>{{ item.storeCount }}</strong>
            </article>
            <article data-testid="platform-tenant-details-metric-active-store-count">
              <span>Stores activas</span><strong>{{ item.activeStoreCount }}</strong>
            </article>
            <article data-testid="platform-tenant-details-metric-users-count">
              <span>Usuarios</span><strong>{{ item.usersCount }}</strong>
            </article>
            <article data-testid="platform-tenant-details-metric-users-without-store">
              <span>Usuarios sin store</span
              ><strong>{{ item.usersWithoutStoreAssignmentCount }}</strong>
            </article>
            <article data-testid="platform-tenant-details-metric-stores-without-admin">
              <span>Stores sin AdminStore</span
              ><strong>{{ item.storesWithoutAdminStoreCount }}</strong>
            </article>
          </div>
          @if (item.storesWithoutAdminStoreCount > 0) {
            <button
              type="button"
              class="btn-highlight"
              data-testid="platform-tenant-details-action-review-stores-without-admin"
              (click)="goToStoresWithoutAdminFilter()"
            >
              Revisar stores sin AdminStore
            </button>
          }
        </section>

        <section class="card technical">
          <h3>Metadata técnica</h3>
          <p><strong>Tenant ID:</strong> {{ item.id }}</p>
          <p><strong>Vertical ID:</strong> {{ item.verticalId }}</p>
          <p><strong>DefaultStore ID:</strong> {{ item.defaultStoreId ?? '—' }}</p>
          <p><strong>CatalogTemplate ID:</strong> {{ item.catalogTemplateId ?? '—' }}</p>
        </section>
      }

      @if (showEdit()) {
        <section class="card">
          <h3>Editar tenant</h3>
          <form data-testid="platform-tenant-edit-form" (submit)="save($event)">
            <label>
              Name
              <input data-testid="platform-tenant-edit-name" [formControl]="nameControl" />
            </label>
            <label>
              Slug
              <input data-testid="platform-tenant-edit-slug" [formControl]="slugControl" />
            </label>
            <label>
              Vertical
              <select data-testid="platform-tenant-edit-vertical" [formControl]="verticalControl">
                <option value="">Sin cambio</option>
                @for (vertical of verticals(); track vertical.id) {
                  <option [value]="vertical.id">{{ vertical.name }}</option>
                }
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                data-testid="platform-tenant-edit-active"
                [formControl]="isActiveControl"
              />
              Is Active
            </label>
            <div class="actions">
              <button type="submit" data-testid="platform-tenant-edit-submit" [disabled]="saving()">
                Guardar
              </button>
              <button
                type="button"
                data-testid="platform-tenant-edit-cancel"
                (click)="cancelEdit()"
                [disabled]="saving()"
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .tenant-details-page {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .header,
      .actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
        justify-content: space-between;
      }
      .card {
        border: 1px solid #ead7c8;
        border-radius: 12px;
        padding: 1rem;
        background: #fff;
      }
      .grid,
      .metrics-grid {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }
      .metrics article {
        border: 1px solid #efe4dc;
        border-radius: 10px;
        padding: 0.75rem;
        display: flex;
        justify-content: space-between;
      }
      .technical p {
        margin: 0.25rem 0;
        color: #64748b;
      }
      .alert {
        margin: 0;
        padding: 0.6rem 0.8rem;
        border-radius: 8px;
      }
      .error {
        background: #fee2e2;
        color: #b91c1c;
      }
      .success {
        background: #dcfce7;
        color: #166534;
      }
      form {
        display: grid;
        gap: 0.75rem;
      }
      input,
      select {
        width: 100%;
      }
      .btn-outline,
      .btn-highlight,
      button {
        border-radius: 8px;
        border: 1px solid #d5bca8;
        background: #fff;
        padding: 0.5rem 0.8rem;
      }
      .btn-highlight {
        background: #fef3c7;
      }
    `,
  ],
})
export class TenantDetailsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tenantsApi = inject(PlatformTenantsApiService);
  private readonly verticalsApi = inject(PlatformVerticalsApiService);

  readonly tenant = signal<PlatformTenantDetailsDto | null>(null);
  readonly verticals = signal<PlatformVerticalDto[]>([]);
  readonly error = signal('');
  readonly success = signal('');
  readonly showEdit = signal(false);
  readonly saving = signal(false);
  readonly tenantId = computed(() => this.route.snapshot.paramMap.get('tenantId') ?? '');

  readonly nameControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  readonly slugControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  readonly verticalControl = new FormControl('', { nonNullable: true });
  readonly isActiveControl = new FormControl(true, { nonNullable: true });

  constructor() {
    void this.load();
  }

  async load() {
    this.error.set('');
    try {
      const [tenant, verticals] = await Promise.all([
        this.tenantsApi.getTenantDetails(this.tenantId()),
        this.verticalsApi.listVerticals(),
      ]);
      this.tenant.set(tenant);
      this.verticals.set(verticals);
    } catch (error: unknown) {
      this.error.set(this.mapError(error, 'No fue posible cargar el tenant.'));
    }
  }

  openEdit() {
    const item = this.tenant();
    if (!item) return;
    this.success.set('');
    this.error.set('');
    this.nameControl.setValue(item.name);
    this.slugControl.setValue(item.slug);
    this.verticalControl.setValue(item.verticalId);
    this.isActiveControl.setValue(item.isActive);
    this.showEdit.set(true);
  }

  cancelEdit() {
    this.showEdit.set(false);
  }

  async save(event: Event) {
    event.preventDefault();
    if (!this.tenant() || this.nameControl.invalid || this.slugControl.invalid || this.saving()) {
      this.nameControl.markAsTouched();
      this.slugControl.markAsTouched();
      return;
    }

    this.error.set('');
    this.success.set('');
    this.saving.set(true);
    try {
      const updated = await this.tenantsApi.updateTenantDetails(this.tenantId(), {
        name: this.nameControl.value.trim(),
        slug: this.slugControl.value.trim(),
        verticalId: this.verticalControl.value || null,
        isActive: this.isActiveControl.value,
      });
      this.tenant.set(updated);
      this.success.set('Tenant actualizado correctamente.');
      this.showEdit.set(false);
    } catch (error: unknown) {
      this.error.set(this.mapError(error, 'No fue posible guardar los cambios.'));
    } finally {
      this.saving.set(false);
    }
  }

  goToStores() {
    void this.router.navigate(['/app/platform/tenants', this.tenantId(), 'stores']);
  }

  goToUsers() {
    void this.router.navigate(['/app/admin/users'], {
      queryParams: { tenantId: this.tenantId() },
    });
  }

  goToDashboard() {
    void this.router.navigate(['/app/platform/dashboard']);
  }

  goToReports() {
    void this.router.navigate(['/app/platform/dashboard'], {
      queryParams: { tenantId: this.tenantId() },
    });
  }

  canOpenInventory() {
    return !!this.tenant()?.defaultStoreId;
  }

  goToInventory() {
    const defaultStoreId = this.tenant()?.defaultStoreId;
    if (!defaultStoreId) {
      return;
    }

    void this.router.navigate(['/app/admin/pos/inventory'], {
      queryParams: {
        tenantId: this.tenantId(),
        storeId: defaultStoreId,
      },
    });
  }

  goToStoresWithoutAdminFilter() {
    void this.router.navigate(['/app/platform/tenants', this.tenantId(), 'stores'], {
      queryParams: { withoutAdminStore: 'true' },
    });
  }

  private mapError(error: unknown, fallback: string) {
    const payload = error as { error?: ProblemLike };
    const firstError = payload?.error?.errors
      ? Object.values(payload.error.errors)
          .flat()
          .find((item) => !!item)
      : null;
    return firstError ?? payload?.error?.detail ?? payload?.error?.title ?? fallback;
  }
}
