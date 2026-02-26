import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { PlatformCatalogTemplatesApiService } from '../../services/platform-catalog-templates-api.service';
import { CatalogTemplateDto } from '../../models/platform.models';

@Component({
  selector: 'app-platform-catalog-templates-page',
  imports: [ReactiveFormsModule, DatePipe],
  template: `
    <div class="templates-page">
      <!-- HEADER con barra decorativa -->
      <header class="page-header">
        <h2>📋 Plantillas de catálogo</h2>
        <p class="page-subtitle">Administra las plantillas disponibles por vertical</p>
        <div class="header-decoration"></div>
      </header>

      <!-- TARJETA DE FILTROS Y ACCIONES -->
      <div class="section-card filters-card">
        <div class="filters-row">
          <div class="filter-field">
            <label for="vertical-filter">Filtrar por vertical</label>
            <input
              id="vertical-filter"
              [formControl]="verticalFilterControl"
              placeholder="ID del vertical"
              class="form-input"
            />
          </div>
          <button
            type="button"
            class="btn-primary"
            (click)="loadTemplates()"
            data-testid="platform-template-filter"
          >
            🔍 Filtrar
          </button>
          <button
            type="button"
            class="btn-outline"
            data-testid="platform-template-create"
            (click)="startCreate()"
          >
            ✨ Crear nueva
          </button>
        </div>
      </div>

      <!-- FORMULARIO DE CREACIÓN/EDICIÓN (solo si está activo) -->
      @if (isEditing()) {
        <div class="section-card form-card">
          <div class="section-header">
            <span class="section-icon">✏️</span>
            <h3>{{ editingId() ? 'Editar plantilla' : 'Nueva plantilla' }}</h3>
          </div>
          <form (submit)="saveTemplate($event)" class="template-form">
            <div class="form-grid">
              <div class="form-field">
                <label for="vertical-id">Vertical ID</label>
                <input
                  id="vertical-id"
                  [formControl]="verticalIdControl"
                  placeholder="Ej: restaurant, retail"
                  class="form-input"
                />
                @if (verticalIdControl.invalid && verticalIdControl.touched) {
                  <div class="field-error">El vertical ID es obligatorio</div>
                }
              </div>

              <div class="form-field">
                <label for="template-name">Nombre</label>
                <input
                  id="template-name"
                  [formControl]="nameControl"
                  placeholder="Ej: Plantilla base restaurantes"
                  class="form-input"
                />
                @if (nameControl.invalid && nameControl.touched) {
                  <div class="field-error">El nombre es obligatorio</div>
                }
              </div>

              <div class="form-field">
                <label for="template-version">Versión (opcional)</label>
                <input
                  id="template-version"
                  [formControl]="versionControl"
                  placeholder="Ej: v1, 2025.1"
                  class="form-input"
                />
              </div>

              <div class="form-field checkbox-field">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    [formControl]="isActiveControl"
                    class="checkbox-input"
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
                  [disabled]="verticalIdControl.invalid || nameControl.invalid"
                  data-testid="platform-template-save"
                >
                  💾 Guardar
                </button>
              </div>
            </div>
          </form>
        </div>
      }

      <!-- MENSAJE DE ERROR -->
      @if (error()) {
        <div class="error-message" role="alert">
          <span class="error-icon">⚠️</span>
          <span>{{ error() }}</span>
        </div>
      }

      <!-- TABLA DE RESULTADOS -->
      <div class="section-card">
        <div class="section-header">
          <span class="section-icon">📋</span>
          <h3>Plantillas existentes</h3>
          @if (templates().length > 0) {
            <span class="count-badge">{{ templates().length }} plantilla(s)</span>
          }
        </div>

        @if (templates().length === 0) {
          <div class="empty-state">
            <span class="empty-icon">📭</span>
            <p>No hay plantillas para mostrar</p>
            <p class="empty-hint">Crea una nueva plantilla o ajusta el filtro</p>
          </div>
        } @else {
          <div class="table-responsive">
            <table class="modern-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Vertical</th>
                  <th>Versión</th>
                  <th>Activo</th>
                  <th>Actualización</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (item of templates(); track item.id; let i = $index) {
                  <tr [attr.data-testid]="'platform-template-row-' + i">
                    <td>{{ item.name }}</td>
                    <td>{{ item.verticalId }}</td>
                    <td>{{ item.version ?? '—' }}</td>
                    <td>
                      <span
                        class="status-badge"
                        [class.status-badge--active]="item.isActive"
                        [class.status-badge--inactive]="!item.isActive"
                      >
                        {{ item.isActive ? '✅ Sí' : '⛔ No' }}
                      </span>
                    </td>
                    <td>{{ item.updatedAtUtc | date:'dd/MM/yyyy HH:mm' }}</td>
                    <td>
                      <button
                        type="button"
                        class="btn-outline btn-small"
                        (click)="edit(item)"
                      >
                        ✏️ Editar
                      </button>
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

    .templates-page {
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
      flex: 1 1 250px;
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

    .form-input {
      width: 90%;
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

    /* ===== FORMULARIO ===== */
    .template-form {
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

    /* ===== ERROR MESSAGE ===== */
    .error-message {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      background: rgba(180, 35, 24, 0.08);
      border: 1px solid rgba(180, 35, 24, 0.2);
      border-radius: var(--radius-md);
      color: #b42318;
      font-weight: 500;
      animation: slide-down 200ms ease-out;
    }

    .error-icon {
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

    /* ===== RESPONSIVE ===== */
    @media (max-width: 900px) {
      .filters-row {
        flex-direction: column;
        align-items: stretch;
      }

      .filter-field {
        width: 100%;
      }

      .btn-primary, .btn-outline {
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

      .modern-table th, .modern-table td {
        padding: 0.5rem 0.75rem;
        font-size: 0.85rem;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogTemplatesPage {
  private readonly api = inject(PlatformCatalogTemplatesApiService);

  readonly templates = signal<CatalogTemplateDto[]>([]);
  readonly error = signal('');
  readonly editingId = signal<string | null>(null);
  readonly isEditing = computed(() => this.editingId() !== null || this.nameControl.value.length > 0);

  readonly verticalFilterControl = new FormControl('', { nonNullable: true });
  readonly verticalIdControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly nameControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly versionControl = new FormControl('', { nonNullable: true });
  readonly isActiveControl = new FormControl(true, { nonNullable: true });

  constructor() {
    void this.loadTemplates();
  }

  async loadTemplates() {
    this.error.set('');
    try {
      this.templates.set(await this.api.listTemplates(this.verticalFilterControl.value || undefined));
    } catch {
      this.error.set('No fue posible cargar templates.');
    }
  }

  startCreate() {
    this.editingId.set('');
    this.verticalIdControl.setValue('');
    this.nameControl.setValue('');
    this.versionControl.setValue('');
    this.isActiveControl.setValue(true);
  }

  cancelEdit() {
    this.editingId.set(null);
    this.verticalIdControl.setValue('');
    this.nameControl.setValue('');
    this.versionControl.setValue('');
    this.isActiveControl.setValue(true);
  }

  edit(item: CatalogTemplateDto) {
    this.editingId.set(item.id);
    this.verticalIdControl.setValue(item.verticalId);
    this.nameControl.setValue(item.name);
    this.versionControl.setValue(item.version ?? '');
    this.isActiveControl.setValue(item.isActive);
  }

  async saveTemplate(event: Event) {
    event.preventDefault();
    if (this.verticalIdControl.invalid || this.nameControl.invalid) {
      this.verticalIdControl.markAsTouched();
      this.nameControl.markAsTouched();
      return;
    }

    const payload = {
      verticalId: this.verticalIdControl.value,
      name: this.nameControl.value,
      version: this.versionControl.value || null,
      isActive: this.isActiveControl.value,
    };

    try {
      if (this.editingId()) {
        await this.api.updateTemplate(this.editingId()!, payload);
      } else {
        await this.api.createTemplate(payload);
      }
      this.cancelEdit();
      await this.loadTemplates();
    } catch {
      this.error.set('No fue posible guardar template.');
    }
  }
}