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
    <div class="tenant-details-page" data-testid="platform-tenant-details-page">
      <!-- HEADER con título y acciones -->
      <header class="dashboard-header">
        <div>
          <h2>{{ tenant()?.name ?? 'Tenant' }}</h2>
          <p class="page-subtitle">Detalle y configuración básica del tenant</p>
          <div class="header-decoration"></div>
        </div>
        <div class="header-actions">
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
            👥 Usuarios
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
            data-testid="platform-tenant-details-action-inventory"
            [disabled]="!canOpenInventory()"
            (click)="goToInventory()"
          >
            📦 Inventario
          </button>
        </div>
      </header>

      <!-- MENSAJES DE ÉXITO / ERROR -->
      @if (error()) {
        <div class="error-message" data-testid="platform-tenant-edit-error">
          <span class="error-icon">⚠️</span>
          <span>{{ error() }}</span>
        </div>
      }
      @if (success()) {
        <div class="success-message" data-testid="platform-tenant-edit-success">
          <span class="success-icon">✅</span>
          <span>{{ success() }}</span>
        </div>
      }

      <!-- DATOS DEL TENANT (solo si hay tenant cargado) -->
      @if (tenant(); as item) {
        <!-- TARJETA DE IDENTIDAD -->
        <div class="section-card">
          <div class="section-header">
            <span class="section-icon">🏷️</span>
            <h3>Identidad</h3>
          </div>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Name</span>
              <span class="info-value" data-testid="platform-tenant-details-name">{{ item.name }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Slug</span>
              <span class="info-value" data-testid="platform-tenant-details-slug">{{ item.slug }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Vertical</span>
              <span class="info-value" data-testid="platform-tenant-details-vertical">{{
                item.verticalName ?? '—'
              }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Template</span>
              <span class="info-value" data-testid="platform-tenant-details-template">{{
                item.catalogTemplateName ?? 'Sin template'
              }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Tienda por defecto</span>
              <span class="info-value" data-testid="platform-tenant-details-default-store">{{
                item.defaultStoreName ?? 'Sin tienda'
              }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Activo</span>
              <span class="info-value" data-testid="platform-tenant-details-active">{{
                item.isActive ? 'Sí' : 'No'
              }}</span>
            </div>
          </div>
        </div>

        <!-- TARJETA DE MÉTRICAS -->
        <div class="section-card">
          <div class="section-header">
            <span class="section-icon">📊</span>
            <h3>Métricas</h3>
          </div>
          <div class="kpi-grid">
            <div class="kpi-card" data-testid="platform-tenant-details-metric-store-count">
              <span>Stores</span>
              <strong>{{ item.storeCount }}</strong>
            </div>
            <div class="kpi-card" data-testid="platform-tenant-details-metric-active-store-count">
              <span>Stores activas</span>
              <strong>{{ item.activeStoreCount }}</strong>
            </div>
            <div class="kpi-card" data-testid="platform-tenant-details-metric-users-count">
              <span>Usuarios</span>
              <strong>{{ item.usersCount }}</strong>
            </div>
            <div class="kpi-card" data-testid="platform-tenant-details-metric-users-without-store">
              <span>Usuarios sin store</span>
              <strong>{{ item.usersWithoutStoreAssignmentCount }}</strong>
            </div>
            <div class="kpi-card" data-testid="platform-tenant-details-metric-stores-without-admin">
              <span>Stores sin AdminStore</span>
              <strong>{{ item.storesWithoutAdminStoreCount }}</strong>
            </div>
          </div>
          @if (item.storesWithoutAdminStoreCount > 0) {
            <button
              type="button"
              class="btn-primary"
              style="margin-top: 0.5rem; align-self: flex-start;"
              data-testid="platform-tenant-details-action-review-stores-without-admin"
              (click)="goToStoresWithoutAdminFilter()"
            >
              Revisar stores sin AdminStore
            </button>
          }
        </div>

        <!-- TARJETA DE METADATOS TÉCNICOS -->
        <div class="section-card">
          <div class="section-header">
            <span class="section-icon">⚙️</span>
            <h3>Metadata técnica</h3>
          </div>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Tenant ID</span>
              <span class="info-value">{{ item.id }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Vertical ID</span>
              <span class="info-value">{{ item.verticalId }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">DefaultStore ID</span>
              <span class="info-value">{{ item.defaultStoreId ?? '—' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">CatalogTemplate ID</span>
              <span class="info-value">{{ item.catalogTemplateId ?? '—' }}</span>
            </div>
          </div>
        </div>
      }

      <!-- FORMULARIO DE EDICIÓN -->
      @if (showEdit()) {
        <div class="section-card">
          <div class="section-header">
            <span class="section-icon">✏️</span>
            <h3>Editar tenant</h3>
          </div>
          <form data-testid="platform-tenant-edit-form" (submit)="save($event)" class="edit-form">
            <div class="form-grid">
              <div class="form-field">
                <label for="edit-name">Name</label>
                <input
                  id="edit-name"
                  type="text"
                  data-testid="platform-tenant-edit-name"
                  [formControl]="nameControl"
                  class="form-input"
                />
                @if (nameControl.invalid && nameControl.touched) {
                  <div class="field-error">El nombre es obligatorio</div>
                }
              </div>

              <div class="form-field">
                <label for="edit-slug">Slug</label>
                <input
                  id="edit-slug"
                  type="text"
                  data-testid="platform-tenant-edit-slug"
                  [formControl]="slugControl"
                  class="form-input"
                />
                @if (slugControl.invalid && slugControl.touched) {
                  <div class="field-error">El slug es obligatorio</div>
                }
              </div>

              <div class="form-field">
                <label for="edit-vertical">Vertical</label>
                <div class="select-wrapper">
                  <select
                    id="edit-vertical"
                    data-testid="platform-tenant-edit-vertical"
                    [formControl]="verticalControl"
                    class="form-select"
                  >
                    <option value="">Sin cambio</option>
                    @for (vertical of verticals(); track vertical.id) {
                      <option [value]="vertical.id">{{ vertical.name }}</option>
                    }
                  </select>
                </div>
              </div>

              <div class="form-field checkbox-field">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    data-testid="platform-tenant-edit-active"
                    [formControl]="isActiveControl"
                    class="checkbox-input"
                  />
                  <span class="checkbox-text">Activo</span>
                </label>
              </div>

              <div class="form-actions">
                <button
                  type="submit"
                  class="btn-primary"
                  data-testid="platform-tenant-edit-submit"
                  [disabled]="saving()"
                >
                  💾 Guardar
                </button>
                <button
                  type="button"
                  class="btn-outline"
                  data-testid="platform-tenant-edit-cancel"
                  (click)="cancelEdit()"
                  [disabled]="saving()"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </form>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      /* Variables de diseño - mismas que en el resto del sistema */
      --brand-rose: #f3b6c2;
      --brand-rose-strong: #e89aac;
      --brand-cream: #fbf6ef;
      --brand-cocoa: #6b3f2a;
      --brand-ink: #0f172a;
      --brand-muted: #475569;
      --ring: rgba(232, 154, 172, 0.55);
      --border: rgba(243, 182, 194, 0.35);
      --shadow: 0 20px 60px rgba(15, 23, 42, 0.14);
      --shadow-sm: 0 8px 20px rgba(201, 141, 106, 0.12);
      --shadow-hover: 0 12px 28px rgba(201, 141, 106, 0.25);
      --radius-md: 0.75rem;
      --radius-lg: 22px;
      --radius-card: 18px;
      --transition: 140ms ease;
    }

    .tenant-details-page {
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
    }

    /* ===== HEADER ===== */
    .dashboard-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .dashboard-header h2 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--brand-cocoa);
      letter-spacing: -0.02em;
    }

    .page-subtitle {
      margin: 0.25rem 0 0;
      color: var(--brand-muted);
      font-size: 0.95rem;
      font-weight: 500;
    }

    .header-decoration {
      width: 60px;
      height: 4px;
      background: linear-gradient(90deg, var(--brand-rose-strong), #c98d6a);
      border-radius: 999px;
      margin-top: 0.5rem;
    }

    .header-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    /* ===== TARJETAS ===== */
    .section-card {
      background: white;
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 1.5rem;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.25rem;
    }

    .section-icon {
      font-size: 1.5rem;
      color: var(--brand-cocoa);
    }

    .section-header h3 {
      margin: 0;
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--brand-ink);
    }

    /* ===== GRID DE INFORMACIÓN (identidad y metadata) ===== */
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }

    .info-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .info-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--brand-muted);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .info-value {
      font-size: 1rem;
      font-weight: 600;
      color: var(--brand-ink);
    }

    /* ===== KPIs ===== */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
    }

    .kpi-card {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 1rem;
      background: rgba(243, 182, 194, 0.08);
      border-radius: var(--radius-card);
      border: 1px solid var(--border);
    }

    .kpi-card span {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--brand-muted);
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }

    .kpi-card strong {
      font-size: 1.3rem;
      font-weight: 800;
      color: var(--brand-cocoa);
      line-height: 1.2;
    }

    /* ===== BOTONES ===== */
    .btn-primary {
      background: linear-gradient(135deg, var(--brand-rose-strong), #c98d6a);
      color: white;
      border: none;
      border-radius: 999px;
      padding: 0.65rem 1.6rem;
      font-weight: 700;
      font-size: 0.9rem;
      letter-spacing: 0.02em;
      box-shadow: 0 8px 20px rgba(201, 141, 106, 0.25);
      transition: transform var(--transition), filter var(--transition), box-shadow var(--transition);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      white-space: nowrap;
    }

    .btn-primary:hover:not([disabled]) {
      transform: translateY(-2px);
      filter: saturate(1.1) brightness(0.98);
      box-shadow: 0 12px 28px rgba(201, 141, 106, 0.4);
    }

    .btn-primary[disabled] {
      opacity: 0.6;
      cursor: not-allowed;
      box-shadow: none;
      filter: grayscale(0.4);
    }

    .btn-outline {
      background: white;
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 0.65rem 1.4rem;
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--brand-cocoa);
      transition: all var(--transition);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }

    .btn-outline:hover:not([disabled]) {
      background: rgba(243, 182, 194, 0.1);
      border-color: var(--brand-rose-strong);
      transform: translateY(-2px);
      box-shadow: var(--shadow-sm);
    }

    .btn-outline[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* ===== FORMULARIO ===== */
    .edit-form {
      width: 100%;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      align-items: flex-end;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .form-field label {
      font-weight: 600;
      font-size: 0.85rem;
      color: var(--brand-ink);
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }

    .form-input {
      width: 100%;
      padding: 0.65rem 1rem;
      border-radius: 999px;
      border: 1px solid rgba(107, 63, 42, 0.16);
      background: white;
      font-size: 0.95rem;
      transition: all var(--transition);
    }

    .form-input:hover {
      border-color: rgba(232, 154, 172, 0.45);
    }

    .form-input:focus-visible {
      outline: 3px solid var(--ring);
      outline-offset: 1px;
      border-color: rgba(232, 154, 172, 0.55);
      box-shadow: 0 0 0 4px rgba(232, 154, 172, 0.16);
    }

    .select-wrapper {
      width: 100%;
    }

    .form-select {
      width: 100%;
      padding: 0.65rem 1rem;
      border-radius: 999px;
      border: 1px solid rgba(107, 63, 42, 0.16);
      background: white;
      font-size: 0.95rem;
      transition: all var(--transition);
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b3f2a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 1rem center;
      background-size: 1rem;
    }

    .form-select:hover {
      border-color: rgba(232, 154, 172, 0.45);
    }

    .form-select:focus-visible {
      outline: 3px solid var(--ring);
      outline-offset: 1px;
      border-color: rgba(232, 154, 172, 0.55);
      box-shadow: 0 0 0 4px rgba(232, 154, 172, 0.16);
    }

    .checkbox-field {
      justify-content: flex-end;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 500;
      color: var(--brand-ink);
      cursor: pointer;
      padding: 0.5rem 0;
    }

    .checkbox-input {
      width: 18px;
      height: 18px;
      accent-color: var(--brand-rose-strong);
      border-radius: 4px;
      cursor: pointer;
    }

    .field-error {
      font-size: 0.75rem;
      color: #b42318;
      margin-top: 0.1rem;
      padding-left: 0.5rem;
    }

    .form-actions {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
      grid-column: -1 / 1;
    }

    /* ===== MENSAJES DE ÉXITO / ERROR ===== */
    .error-message,
    .success-message {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: var(--radius-md);
      font-weight: 500;
      animation: slide-down 200ms ease-out;
    }

    .error-message {
      background: rgba(180, 35, 24, 0.08);
      border: 1px solid rgba(180, 35, 24, 0.2);
      color: #b42318;
    }

    .success-message {
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.2);
      color: #065f46;
    }

    .error-icon,
    .success-icon {
      font-size: 1.1rem;
    }

    @keyframes slide-down {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* ===== RESPONSIVE ===== */
    @media (max-width: 900px) {
      .dashboard-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .header-actions {
        width: 100%;
        justify-content: flex-start;
      }
    }

    @media (max-width: 600px) {
      .section-card {
        padding: 1.25rem;
      }

      .kpi-grid {
        grid-template-columns: 1fr;
      }

      .info-grid {
        grid-template-columns: 1fr;
      }

      .form-actions {
        flex-direction: column;
      }

      .btn-primary,
      .btn-outline {
        width: 100%;
      }
    }
  `],
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