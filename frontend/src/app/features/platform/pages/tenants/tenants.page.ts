import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PlatformTenantDto, PlatformVerticalDto } from '../../models/platform.models';
import { PlatformTenantContextService } from '../../services/platform-tenant-context.service';
import { PlatformTenantsApiService } from '../../services/platform-tenants-api.service';
import { PlatformVerticalsApiService } from '../../services/platform-verticals-api.service';

interface ProblemLike {
  detail?: string;
  title?: string;
}

@Component({
  selector: 'app-platform-tenants-page',
  imports: [ReactiveFormsModule],
  template: `
    <div class="tenants-page" data-testid="platform-tenants-page">
      <!-- HEADER con barra decorativa -->
      <header class="page-header">
        <h2>🏢 Tenants</h2>
        <p class="page-subtitle">Administra los tenants y su tienda matriz</p>
        <div class="header-decoration"></div>
      </header>

      <!-- TARJETA DE FILTROS Y ACCIONES -->
      <div class="section-card filters-card">
        <div class="filters-row">
          <div class="filter-field">
            <label for="search-tenants">Buscar tenant</label>
            <input
              id="search-tenants"
              [formControl]="searchControl"
              placeholder="Nombre o slug"
              class="form-input"
            />
          </div>
          <button
            type="button"
            class="btn-primary"
            data-testid="tenant-create-open"
            (click)="startCreate()"
          >
            ✨ Crear tenant
          </button>
        </div>
        <p class="form-hint">Al crear un tenant se genera automáticamente la tienda Matriz.</p>
      </div>

      <!-- FORMULARIO DE CREACIÓN/EDICIÓN (solo si está activo) -->
      @if (showForm()) {
        <div class="section-card form-card">
          <div class="section-header">
            <span class="section-icon">✏️</span>
            <h3>{{ editingId() === 'new' ? 'Nuevo tenant' : 'Editar tenant' }}</h3>
          </div>
          <form (submit)="save($event)" class="tenant-form">
            <div class="form-grid">
              <div class="form-field">
                <label for="tenant-name">Nombre</label>
                <input
                  id="tenant-name"
                  [formControl]="nameControl"
                  placeholder="Ej: Restaurantes del Norte"
                  class="form-input"
                  data-testid="tenant-form-name"
                />
                @if (nameControl.invalid && nameControl.touched) {
                  <div class="field-error">El nombre es obligatorio</div>
                }
              </div>

              <div class="form-field">
                <label for="tenant-slug">Slug</label>
                <input
                  id="tenant-slug"
                  [formControl]="slugControl"
                  placeholder="Ej: restaurantes-norte"
                  class="form-input"
                  data-testid="tenant-form-slug"
                />
                @if (slugControl.invalid && slugControl.touched) {
                  <div class="field-error">El slug es obligatorio</div>
                }
              </div>

              <div class="form-field">
                <label for="tenant-vertical">Vertical</label>
                <select
                  id="tenant-vertical"
                  [formControl]="verticalControl"
                  class="form-select"
                  data-testid="tenant-form-vertical"
                >
                  <option value="" disabled>Selecciona un vertical</option>
                  @for (vertical of verticals(); track vertical.id) {
                    <option [value]="vertical.id">{{ vertical.name }}</option>
                  }
                </select>
                @if (verticalControl.invalid && verticalControl.touched) {
                  <div class="field-error">Debes seleccionar un vertical</div>
                }
              </div>

              <div class="form-field checkbox-field">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    [formControl]="isActiveControl"
                    class="checkbox-input"
                    data-testid="tenant-form-is-active"
                  />
                  <span class="checkbox-text">Activo</span>
                </label>
              </div>

              <div class="form-actions">
                <button
                  type="button"
                  class="btn-outline"
                  (click)="cancelEdit()"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  class="btn-primary"
                  [disabled]="nameControl.invalid || slugControl.invalid || verticalControl.invalid"
                  data-testid="tenant-save"
                >
                  💾 Guardar
                </button>
              </div>
            </div>
          </form>
        </div>
      }

      <!-- MENSAJES DE ÉXITO Y ERROR -->
      @if (error()) {
        <div class="error-message" role="alert" data-testid="platform-tenants-error">
          <span class="error-icon">⚠️</span>
          <span>{{ error() }}</span>
        </div>
      }
      @if (success()) {
        <div class="success-message" data-testid="platform-tenants-success">
          <span class="success-icon">✅</span>
          <span>{{ success() }}</span>
        </div>
      }

      <!-- TABLA DE TENANTS -->
      <div class="section-card">
        <div class="section-header">
          <span class="section-icon">📋</span>
          <h3>Listado de tenants</h3>
          @if (filteredTenants().length > 0) {
            <span class="count-badge">{{ filteredTenants().length }} tenant(s)</span>
          }
        </div>

        @if (filteredTenants().length === 0) {
          <div class="empty-state">
            <span class="empty-icon">📭</span>
            <p>No hay tenants para mostrar</p>
            <p class="empty-hint">Crea un nuevo tenant o ajusta la búsqueda</p>
          </div>
        } @else {
          <div class="table-responsive">
            <table class="modern-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Slug</th>
                  <th>Vertical</th>
                  <th>Activo</th>
                  <th>Tienda matriz</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (item of filteredTenants(); track item.id) {
                  <tr [attr.data-testid]="'tenant-row-' + item.id">
                    <td>{{ item.name }}</td>
                    <td>{{ item.slug }}</td>
                    <td>{{ verticalName(item.verticalId) }}</td>
                    <td>
                      <span
                        class="status-badge"
                        [class.status-badge--active]="item.isActive"
                        [class.status-badge--inactive]="!item.isActive"
                      >
                        {{ item.isActive ? '✅ Sí' : '⛔ No' }}
                      </span>
                    </td>
                    <td>{{ item.defaultStoreId ?? '—' }}</td>
                    <td>
                      <div class="action-buttons">
                        <button
                          type="button"
                          class="btn-outline btn-small"
                          [attr.data-testid]="'tenant-edit-' + item.id"
                          (click)="edit(item)"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          type="button"
                          class="btn-outline btn-small btn-danger"
                          [attr.data-testid]="'tenant-delete-' + item.id"
                          (click)="remove(item)"
                        >
                          🗑️ Eliminar
                        </button>
                        <button
                          type="button"
                          class="btn-outline btn-small"
                          [attr.data-testid]="'tenant-set-context-' + item.id"
                          (click)="setTenantContext(item.id)"
                        >
                          🔑 Usar contexto
                        </button>
                        <button
                          type="button"
                          class="btn-outline btn-small"
                          [attr.data-testid]="'tenant-view-stores-' + item.id"
                          (click)="viewStores(item.id)"
                        >
                          🏬 Ver stores
                        </button>
                        @if (selectedTenantId() === item.id) {
                          <span class="context-badge" [attr.data-testid]="'tenant-context-active-' + item.id">
                            Activo
                          </span>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      /* Variables de diseño - mismas que en POS y Admin */
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

    .tenants-page {
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
    }

    /* ===== HEADER ===== */
    .page-header {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      position: relative;
    }

    .page-header h2 {
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--brand-cocoa);
      margin: 0;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .page-subtitle {
      margin: 0;
      color: var(--brand-muted);
      font-size: 0.95rem;
      font-weight: 500;
    }

    .header-decoration {
      width: 60px;
      height: 4px;
      background: linear-gradient(90deg, var(--brand-rose-strong), #c98d6a);
      border-radius: 999px;
      margin-top: 0.25rem;
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

    .count-badge {
      margin-left: auto;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--brand-muted);
      background: rgba(243, 182, 194, 0.2);
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
    }

    /* ===== FILTROS ===== */
    .filters-row {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: flex-end;
    }

    .filter-field {
      flex: 1 1 300px;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .filter-field label {
      font-weight: 600;
      font-size: 0.85rem;
      color: var(--brand-ink);
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }

    .form-input,
    .form-select {
      width: 100%;
      padding: 0.65rem 1rem;
      border-radius: 999px;
      border: 1px solid rgba(107, 63, 42, 0.16);
      background: white;
      font-size: 0.95rem;
      transition: all var(--transition);
    }

    .form-select {
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b3f2a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 1rem center;
      background-size: 1rem;
    }

    .form-input:hover,
    .form-select:hover {
      border-color: rgba(232, 154, 172, 0.45);
    }

    .form-input:focus-visible,
    .form-select:focus-visible {
      outline: 3px solid var(--ring);
      outline-offset: 1px;
      border-color: rgba(232, 154, 172, 0.55);
      box-shadow: 0 0 0 4px rgba(232, 154, 172, 0.16);
    }

    .form-hint {
      margin: 0;
      font-size: 0.8rem;
      color: var(--brand-muted);
      background: rgba(243, 182, 194, 0.12);
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
      width: fit-content;
    }

    /* ===== FORMULARIO DE TENANT ===== */
    .tenant-form {
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

    .btn-small {
      padding: 0.45rem 1.1rem;
      font-size: 0.85rem;
    }

    .btn-danger {
      color: #b42318;
      border-color: rgba(180, 35, 24, 0.3);
    }

    .btn-danger:hover:not([disabled]) {
      background: rgba(180, 35, 24, 0.08);
      border-color: #b42318;
    }

    /* ===== MENSAJES DE ÉXITO Y ERROR ===== */
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

    /* ===== ESTADO VACÍO ===== */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2.5rem 2rem;
      text-align: center;
      background: rgba(243, 182, 194, 0.08);
      border: 1px dashed var(--border);
      border-radius: var(--radius-lg);
      color: var(--brand-muted);
    }

    .empty-icon {
      font-size: 2.5rem;
      margin-bottom: 0.75rem;
      opacity: 0.7;
    }

    .empty-state p {
      margin: 0;
      font-weight: 500;
    }

    .empty-hint {
      font-size: 0.9rem;
      margin-top: 0.5rem;
      color: var(--brand-muted);
      opacity: 0.8;
    }

    /* ===== TABLA ===== */
    .table-responsive {
      overflow-x: auto;
      border-radius: var(--radius-md);
    }

    .modern-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }

    .modern-table th {
      text-align: left;
      padding: 0.75rem 1rem;
      background: rgba(243, 182, 194, 0.12);
      color: var(--brand-cocoa);
      font-weight: 700;
      border-bottom: 2px solid var(--border);
      white-space: nowrap;
    }

    .modern-table td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border);
      color: var(--brand-ink);
    }

    .modern-table tr:last-child td {
      border-bottom: none;
    }

    .modern-table tbody tr {
      transition: background var(--transition);
    }

    .modern-table tbody tr:hover {
      background: rgba(243, 182, 194, 0.06);
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 700;
      background: white;
      border: 1px solid transparent;
    }

    .status-badge--active {
      background: rgba(16, 185, 129, 0.1);
      color: #065f46;
      border-color: rgba(16, 185, 129, 0.3);
    }

    .status-badge--inactive {
      background: rgba(107, 114, 128, 0.1);
      color: #4b5563;
      border-color: rgba(107, 114, 128, 0.3);
    }

    .action-buttons {
      display: flex;
      gap: 0.25rem;
      flex-wrap: wrap;
    }

    .context-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      font-size: 0.7rem;
      font-weight: 700;
      background: rgba(232, 154, 172, 0.2);
      color: var(--brand-cocoa);
      border: 1px solid rgba(232, 154, 172, 0.3);
    }

    /* ===== RESPONSIVE ===== */
    @media (max-width: 900px) {
      .filters-row {
        flex-direction: column;
        align-items: stretch;
      }

      .filter-field {
        width: 100%;
      }

      .btn-primary {
        width: 100%;
      }

      .form-actions {
        grid-column: span 1;
        justify-content: stretch;
      }
    }

    @media (max-width: 600px) {
      .section-card {
        padding: 1.25rem;
      }

      .form-grid {
        grid-template-columns: 1fr;
      }

      .modern-table th,
      .modern-table td {
        padding: 0.5rem 0.75rem;
        font-size: 0.85rem;
      }

      .action-buttons {
        flex-direction: column;
        gap: 0.5rem;
      }

      .btn-small {
        width: 100%;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantsPage {
  private readonly tenantsApi = inject(PlatformTenantsApiService);
  private readonly verticalsApi = inject(PlatformVerticalsApiService);
  private readonly tenantContext = inject(PlatformTenantContextService);
  private readonly router = inject(Router);

  readonly tenants = signal<PlatformTenantDto[]>([]);
  readonly verticals = signal<PlatformVerticalDto[]>([]);
  readonly selectedTenantId = signal(this.tenantContext.getSelectedTenantId());
  readonly error = signal('');
  readonly success = signal('');
  readonly editingId = signal<string | null>(null);
  readonly showForm = computed(() => this.editingId() !== null);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly nameControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly slugControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly verticalControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly isActiveControl = new FormControl({ value: true, disabled: true }, { nonNullable: true });

  readonly filteredTenants = computed(() => {
    const term = this.searchControl.value.trim().toLowerCase();
    if (!term) {
      return this.tenants();
    }

    return this.tenants().filter(
      (item) => item.name.toLowerCase().includes(term) || item.slug.toLowerCase().includes(term),
    );
  });

  constructor() {
    void this.load();
  }

  async load() {
    this.error.set('');
    try {
      const [tenants, verticals] = await Promise.all([
        this.tenantsApi.listTenants(),
        this.verticalsApi.listVerticals(),
      ]);
      this.tenants.set(tenants);
      this.verticals.set(verticals);
    } catch (error: unknown) {
      this.error.set(this.mapError(error, 'No fue posible cargar tenants.'));
    }
  }

  verticalName(verticalId: string) {
    return this.verticals().find((item) => item.id === verticalId)?.name ?? verticalId;
  }

  startCreate() {
    this.success.set('');
    this.editingId.set('new');
    this.nameControl.setValue('');
    this.slugControl.setValue('');
    this.verticalControl.setValue('');
    this.isActiveControl.setValue(true);
  }

  cancelEdit() {
    this.editingId.set(null);
    this.nameControl.setValue('');
    this.slugControl.setValue('');
    this.verticalControl.setValue('');
    this.isActiveControl.setValue(true);
  }

  edit(item: PlatformTenantDto) {
    this.success.set('');
    this.editingId.set(item.id);
    this.nameControl.setValue(item.name);
    this.slugControl.setValue(item.slug);
    this.verticalControl.setValue(item.verticalId);
    this.isActiveControl.setValue(item.isActive);
  }

  async save(event: Event) {
    event.preventDefault();
    this.error.set('');
    this.success.set('');

    if (this.nameControl.invalid || this.slugControl.invalid || this.verticalControl.invalid || !this.editingId()) {
      this.nameControl.markAsTouched();
      this.slugControl.markAsTouched();
      this.verticalControl.markAsTouched();
      return;
    }

    try {
      if (this.editingId() === 'new') {
        await this.tenantsApi.createTenant({
          verticalId: this.verticalControl.value,
          name: this.nameControl.value,
          slug: this.slugControl.value,
        });
      } else {
        await this.tenantsApi.updateTenant(this.editingId()!, {
          verticalId: this.verticalControl.value,
          name: this.nameControl.value,
          slug: this.slugControl.value,
        });
      }
      this.success.set('Tenant guardado correctamente.');
      this.editingId.set(null);
      await this.load();
    } catch (error: unknown) {
      this.error.set(this.mapError(error, 'No fue posible guardar tenant.'));
    }
  }

  async remove(item: PlatformTenantDto) {
    this.error.set('');
    this.success.set('');
    if (!window.confirm(`¿Eliminar tenant ${item.name}?`)) {
      return;
    }

    try {
      await this.tenantsApi.deleteTenant(item.id);
      if (this.selectedTenantId() === item.id) {
        this.tenantContext.setSelectedTenantId(null);
        this.selectedTenantId.set(null);
        this.success.set('Tenant eliminado y contexto limpiado.');
      } else {
        this.success.set('Tenant eliminado correctamente.');
      }
      await this.load();
    } catch (error: unknown) {
      this.error.set(this.mapError(error, 'No fue posible eliminar tenant.'));
    }
  }

  setTenantContext(tenantId: string) {
    this.tenantContext.setSelectedTenantId(tenantId);
    this.selectedTenantId.set(tenantId);
    this.success.set('Contexto de tenant actualizado.');
  }

  viewStores(tenantId: string) {
    void this.router.navigate(['/app/platform/tenants', tenantId, 'stores']);
  }

  private mapError(error: unknown, fallback: string) {
    const payload = error as { error?: ProblemLike };
    return payload?.error?.detail ?? payload?.error?.title ?? fallback;
  }
}
