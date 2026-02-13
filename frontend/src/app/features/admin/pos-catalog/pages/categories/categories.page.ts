import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { CategoryDto } from '../../models/pos-catalog.models';
import { PosCatalogApiService } from '../../services/pos-catalog-api.service';

@Component({
  selector: 'app-pos-catalog-categories-page',
  imports: [ReactiveFormsModule],
  template: `
    <div class="categories-page">
      <!-- HEADER con barra decorativa -->
      <header class="page-header">
        <h2>📂 Categorías</h2>
        <p class="page-subtitle">Administra las categorías de productos</p>
        <div class="header-decoration"></div>
      </header>

      <!-- FORMULARIO DE CREACIÓN/EDICIÓN -->
      <form class="category-form" (submit)="onSubmit($event)">
        <div class="form-grid">
          <div class="form-field">
            <label for="category-name">Nombre</label>
            <input
              id="category-name"
              type="text"
              [formControl]="nameControl"
              placeholder="Ej: Bebidas, Comidas, Postres"
              class="form-input"
            />
            @if (nameControl.invalid && nameControl.touched) {
              <div class="field-error">El nombre es obligatorio</div>
            }
          </div>

          <div class="form-field">
            <label for="category-order">Orden</label>
            <input
              id="category-order"
              type="number"
              min="0"
              [formControl]="sortOrderControl"
              placeholder="0"
              class="form-input"
            />
            @if (sortOrderControl.invalid && sortOrderControl.touched) {
              <div class="field-error">Debe ser un número positivo</div>
            }
          </div>

          <div class="form-field checkbox-field">
            <label class="checkbox-label">
              <input
                type="checkbox"
                [formControl]="isActiveControl"
                class="checkbox-input"
              />
              <span class="checkbox-text">Activa</span>
            </label>
          </div>

          <div class="form-actions">
            @if (editingId()) {
              <button type="button" class="btn-outline" (click)="resetForm()">
                Cancelar
              </button>
            }
            <button
              type="submit"
              class="btn-primary"
              [disabled]="nameControl.invalid || sortOrderControl.invalid"
            >
              <span>{{ editingId() ? '💾' : '✨' }}</span>
              {{ editingId() ? 'Guardar cambios' : 'Crear categoría' }}
            </button>
          </div>
        </div>
      </form>

      <!-- MENSAJE DE ERROR -->
      @if (errorMessage()) {
        <div class="error-message" role="alert">
          <span class="error-icon">⚠️</span>
          <span>{{ errorMessage() }}</span>
          <button type="button" class="error-dismiss" (click)="errorMessage.set('')">✕</button>
        </div>
      }

      <!-- LISTA DE CATEGORÍAS -->
      @if (categories().length === 0) {
        <div class="empty-state">
          <span class="empty-icon">🏷️</span>
          <p>No hay categorías creadas</p>
          <p class="empty-hint">Crea tu primera categoría para comenzar</p>
        </div>
      } @else {
        <div class="categories-header">
          <span class="categories-count">
            {{ categories().length }} {{ categories().length === 1 ? 'categoría' : 'categorías' }}
          </span>
        </div>

        <ul class="categories-grid" aria-label="Listado de categorías">
          @for (item of categories(); track item.id) {
            <li class="category-card">
              <div class="category-info">
                <span class="category-icon">📁</span>
                <div class="category-details">
                  <span class="category-name">{{ item.name }}</span>
                  <div class="category-meta">
                    <span class="category-order">#{{ item.sortOrder }}</span>
                    <span
                      class="status-badge"
                      [class.status-badge--active]="item.isActive"
                      [class.status-badge--inactive]="!item.isActive"
                    >
                      {{ item.isActive ? '✅ Activa' : '⛔ Inactiva' }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="category-actions">
                <button
                  type="button"
                  class="btn-outline btn-small"
                  (click)="onEdit(item)"
                >
                  ✏️ Editar
                </button>
                <button
                  type="button"
                  class="btn-outline btn-danger btn-small"
                  (click)="onDeactivate(item)"
                  [disabled]="!item.isActive"
                >
                  🗑️ Desactivar
                </button>
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      /* Variables de diseño - mismas que en el POS y Admin */
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

    .categories-page {
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

    /* ===== FORMULARIO ===== */
    .category-form {
      background: white;
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 1.5rem;
      box-shadow: var(--shadow-sm);
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr auto 1fr;
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
      align-items: center;
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

    .error-dismiss {
      margin-left: auto;
      background: transparent;
      border: none;
      color: #b42318;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      padding: 0.25rem 0.5rem;
      border-radius: 999px;
      transition: background var(--transition);
    }

    .error-dismiss:hover {
      background: rgba(180, 35, 24, 0.1);
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
      padding: 3rem 2rem;
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

    /* ===== ENCABEZADO DE LISTA ===== */
    .categories-header {
      display: flex;
      justify-content: flex-end;
      margin-top: 0.5rem;
    }

    .categories-count {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--brand-muted);
      background: rgba(243, 182, 194, 0.2);
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
    }

    /* ===== GRID DE CATEGORÍAS ===== */
    .categories-grid {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1rem;
    }

    .category-card {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: white;
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      padding: 1.25rem;
      transition: all var(--transition);
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.02);
    }

    .category-card:hover {
      border-color: var(--brand-rose-strong);
      box-shadow: var(--shadow-hover);
      transform: translateY(-2px);
    }

    .category-info {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
      margin-bottom: 1rem;
    }

    .category-icon {
      font-size: 1.8rem;
      color: var(--brand-cocoa);
      opacity: 0.8;
    }

    .category-details {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .category-name {
      font-weight: 700;
      font-size: 1.1rem;
      color: var(--brand-ink);
      word-break: break-word;
    }

    .category-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .category-order {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--brand-muted);
      background: rgba(243, 182, 194, 0.16);
      padding: 0.2rem 0.5rem;
      border-radius: 999px;
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

    .category-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: auto;
      padding-top: 0.75rem;
      border-top: 1px solid var(--border);
    }

    /* ===== RESPONSIVE ===== */
    @media (max-width: 900px) {
      .form-grid {
        grid-template-columns: 1fr 1fr;
      }

      .form-actions {
        grid-column: span 2;
        justify-content: flex-start;
      }
    }

    @media (max-width: 600px) {
      .form-grid {
        grid-template-columns: 1fr;
        gap: 0.75rem;
      }

      .form-actions {
        grid-column: span 1;
      }

      .categories-grid {
        grid-template-columns: 1fr;
      }

      .category-card {
        padding: 1rem;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriesPage {
  private readonly api = inject(PosCatalogApiService);

  readonly categories = signal<CategoryDto[]>([]);
  readonly errorMessage = signal('');
  readonly editingId = signal<string | null>(null);
  readonly nameControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly sortOrderControl = new FormControl(0, { nonNullable: true, validators: [Validators.min(0)] });
  readonly isActiveControl = new FormControl(true, { nonNullable: true });

  constructor() {
    void this.load();
  }

  async onSubmit(event: Event) {
    event.preventDefault();
    if (this.nameControl.invalid || this.sortOrderControl.invalid) {
      this.nameControl.markAsTouched();
      this.sortOrderControl.markAsTouched();
      return;
    }

    this.errorMessage.set('');
    const payload = {
      name: this.nameControl.value.trim(),
      sortOrder: this.sortOrderControl.value,
      isActive: this.isActiveControl.value,
    };

    try {
      const id = this.editingId();
      if (id) {
        await this.api.updateCategory(id, payload);
      } else {
        await this.api.createCategory(payload);
      }
      this.resetForm();
      await this.load();
    } catch {
      this.errorMessage.set('No fue posible guardar la categoría.');
    }
  }

  onEdit(item: CategoryDto) {
    this.editingId.set(item.id);
    this.nameControl.setValue(item.name);
    this.sortOrderControl.setValue(item.sortOrder);
    this.isActiveControl.setValue(item.isActive);
  }

  async onDeactivate(item: CategoryDto) {
    if (!item.isActive) return;
    
    this.errorMessage.set('');
    try {
      await this.api.deactivateCategory(item.id);
      await this.load();
    } catch {
      this.errorMessage.set('No fue posible desactivar la categoría.');
    }
  }

  resetForm() {
    this.editingId.set(null);
    this.nameControl.setValue('');
    this.sortOrderControl.setValue(0);
    this.isActiveControl.setValue(true);
    this.nameControl.markAsUntouched();
    this.sortOrderControl.markAsUntouched();
  }

  private async load() {
    this.errorMessage.set('');
    try {
      this.categories.set(await this.api.getCategories(true));
    } catch {
      this.errorMessage.set('No fue posible cargar categorías.');
    }
  }
}