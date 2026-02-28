import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { PlatformVerticalDto } from '../../models/platform.models';
import { PlatformVerticalsApiService } from '../../services/platform-verticals-api.service';
import { DatePipe } from '@angular/common';

interface ProblemLike {
  detail?: string;
  title?: string;
}

@Component({
  selector: 'app-platform-verticals-page',
  imports: [ReactiveFormsModule, DatePipe],
  template: `
    <div class="verticals-page" data-testid="platform-verticals-page">
      <!-- HEADER con barra decorativa -->
      <header class="page-header">
        <h2>📌 Verticales</h2>
        <p class="page-subtitle">Administra las verticales de negocio (Retail, Restaurantes, etc.)</p>
        <div class="header-decoration"></div>
      </header>

      <!-- TARJETA DE ACCIONES Y FILTRO (búsqueda opcional, pero aquí solo botón crear) -->
      <div class="section-card actions-card">
        <div class="actions-row">
          <button
            type="button"
            class="btn-primary"
            data-testid="vertical-create-open"
            (click)="startCreate()"
          >
            ✨ Nueva vertical
          </button>
        </div>
      </div>

      <!-- FORMULARIO DE CREACIÓN/EDICIÓN -->
      @if (showForm()) {
        <div class="section-card form-card">
          <div class="section-header">
            <span class="section-icon">✏️</span>
            <h3>{{ editingId() === 'new' ? 'Crear vertical' : 'Editar vertical' }}</h3>
          </div>

          <form (submit)="save($event)" class="vertical-form" data-testid="vertical-form">
            <div class="form-grid">
              <!-- Nombre -->
              <div class="form-field">
                <label for="vertical-name">Nombre</label>
                <input
                  id="vertical-name"
                  type="text"
                  [formControl]="nameControl"
                  placeholder="Ej: Retail, Restaurantes"
                  class="form-input"
                  data-testid="vertical-form-name"
                />
                @if (nameControl.invalid && nameControl.touched) {
                  <div class="field-error">El nombre es obligatorio</div>
                }
              </div>

              <!-- Descripción -->
              <div class="form-field">
                <label for="vertical-description">Descripción (opcional)</label>
                <textarea
                  id="vertical-description"
                  [formControl]="descriptionControl"
                  placeholder="Breve descripción de la vertical"
                  class="form-input"
                  rows="3"
                  data-testid="vertical-form-description"
                ></textarea>
              </div>

              <!-- Activo (checkbox) -->
              <div class="form-field checkbox-field">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    [formControl]="isActiveControl"
                    class="checkbox-input"
                    data-testid="vertical-form-is-active"
                  />
                  <span class="checkbox-text">Activo</span>
                </label>
              </div>

              <!-- Acciones del formulario -->
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
                  [disabled]="nameControl.invalid"
                  data-testid="vertical-save"
                >
                  💾 Guardar
                </button>
              </div>
            </div>
          </form>
        </div>
      }

      <!-- MENSAJES DE ERROR Y ÉXITO -->
      @if (error()) {
        <div class="error-message" role="alert" data-testid="platform-verticals-error">
          <span class="error-icon">⚠️</span>
          <span>{{ error() }}</span>
        </div>
      }
      @if (success()) {
        <div class="success-message" data-testid="platform-verticals-success">
          <span class="success-icon">✅</span>
          <span>{{ success() }}</span>
        </div>
      }

      <!-- TABLA DE VERTICALES -->
      <div class="section-card">
        <div class="section-header">
          <span class="section-icon">📋</span>
          <h3>Verticales existentes</h3>
          @if (verticals().length > 0) {
            <span class="count-badge">{{ verticals().length }} vertical(es)</span>
          }
        </div>

        @if (verticals().length === 0) {
          <div class="empty-state">
            <span class="empty-icon">📭</span>
            <p>No hay verticales para mostrar</p>
            <p class="empty-hint">Crea una nueva vertical usando el botón superior</p>
          </div>
        } @else {
          <div class="table-responsive">
            <table class="modern-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Activo</th>
                  <th>Descripción</th>
                  <th>Última actualización</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (item of verticals(); track item.id) {
                  <tr [attr.data-testid]="'vertical-row-' + item.id">
                    <td>{{ item.name }}</td>
                    <td>
                      <span
                        class="status-badge"
                        [class.status-badge--active]="item.isActive"
                        [class.status-badge--inactive]="!item.isActive"
                      >
                        {{ item.isActive ? '✅ Sí' : '⛔ No' }}
                      </span>
                    </td>
                    <td>{{ item.description ?? '—' }}</td>
                    <td>{{ item.updatedAtUtc | date:'dd/MM/yyyy HH:mm' }}</td>
                    <td>
                      <button
                        type="button"
                        class="btn-outline btn-small"
                        [attr.data-testid]="'vertical-edit-' + item.id"
                        (click)="edit(item)"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        type="button"
                        class="btn-outline btn-small btn-danger"
                        [attr.data-testid]="'vertical-delete-' + item.id"
                        (click)="remove(item)"
                      >
                        🗑️ Eliminar
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
      /* Variables de diseño - mismas que en el sistema */
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

    .verticals-page {
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

    /* ===== TARJETAS DE SECCIÓN ===== */
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

    /* ===== FILA DE ACCIONES ===== */
    .actions-row {
      display: flex;
      justify-content: flex-end;
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

    /* ===== FORMULARIO ===== */
    .vertical-form {
      width: 100%;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
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
      font-family: inherit;
    }

    textarea.form-input {
      border-radius: var(--radius-md);
      resize: vertical;
      min-height: 80px;
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

    /* ===== MENSAJES DE ERROR Y ÉXITO ===== */
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

    /* ===== RESPONSIVE ===== */
    @media (max-width: 900px) {
      .form-grid {
        grid-template-columns: 1fr;
      }

      .form-actions {
        grid-column: span 1;
      }

      .actions-row {
        justify-content: stretch;
      }

      .btn-primary {
        width: 100%;
      }
    }

    @media (max-width: 600px) {
      .section-card {
        padding: 1.25rem;
      }

      .modern-table th,
      .modern-table td {
        padding: 0.5rem 0.75rem;
        font-size: 0.85rem;
      }

      .btn-outline.btn-small {
        padding: 0.35rem 0.8rem;
        font-size: 0.8rem;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerticalsPage {
  private readonly api = inject(PlatformVerticalsApiService);

  readonly verticals = signal<PlatformVerticalDto[]>([]);
  readonly error = signal('');
  readonly success = signal('');
  readonly editingId = signal<string | null>(null);
  readonly showForm = computed(() => this.editingId() !== null);

  readonly nameControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly descriptionControl = new FormControl('', { nonNullable: true });
  readonly isActiveControl = new FormControl({ value: true, disabled: true }, { nonNullable: true });

  constructor() {
    void this.load();
  }

  async load() {
    this.error.set('');
    try {
      this.verticals.set(await this.api.listVerticals());
    } catch (error: unknown) {
      this.error.set(this.mapError(error, 'No fue posible cargar verticales.'));
    }
  }

  startCreate() {
    this.success.set('');
    this.editingId.set('new');
    this.nameControl.setValue('');
    this.descriptionControl.setValue('');
    this.isActiveControl.setValue(true);
  }

  cancelEdit() {
    this.editingId.set(null);
    this.nameControl.setValue('');
    this.descriptionControl.setValue('');
    this.isActiveControl.setValue(true);
  }

  edit(item: PlatformVerticalDto) {
    this.success.set('');
    this.editingId.set(item.id);
    this.nameControl.setValue(item.name);
    this.descriptionControl.setValue(item.description ?? '');
    this.isActiveControl.setValue(item.isActive);
  }

  async save(event: Event) {
    event.preventDefault();
    this.error.set('');
    this.success.set('');
    if (this.nameControl.invalid || !this.editingId()) {
      this.nameControl.markAsTouched();
      return;
    }

    const payload = { name: this.nameControl.value, description: this.descriptionControl.value || null };

    try {
      if (this.editingId() === 'new') {
        await this.api.createVertical(payload);
      } else {
        await this.api.updateVertical(this.editingId()!, payload);
      }
      this.success.set('Vertical guardada correctamente.');
      this.cancelEdit();
      await this.load();
    } catch (error: unknown) {
      this.error.set(this.mapError(error, 'No fue posible guardar vertical.'));
    }
  }

  async remove(item: PlatformVerticalDto) {
    this.error.set('');
    this.success.set('');
    if (!window.confirm(`¿Eliminar vertical ${item.name}?`)) {
      return;
    }

    try {
      await this.api.deleteVertical(item.id);
      this.success.set('Vertical eliminada correctamente.');
      await this.load();
    } catch (error: unknown) {
      this.error.set(this.mapError(error, 'No fue posible eliminar vertical.'));
    }
  }

  private mapError(error: unknown, fallback: string) {
    const payload = error as { error?: ProblemLike };
    return payload?.error?.detail ?? payload?.error?.title ?? fallback;
  }
}
