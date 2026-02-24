import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { CategoryDto, ProductDto, SchemaDto } from '../../models/pos-catalog.models';
import { PosCatalogApiService } from '../../services/pos-catalog-api.service';
import { PosAdminCatalogOverridesApiService } from '../../services/pos-admin-catalog-overrides-api.service';
import { PosAdminCatalogAvailabilityApiService } from '../../services/pos-admin-catalog-availability-api.service';
import { StoreContextService } from '../../../../pos/services/store-context.service';
import { PosCatalogSnapshotService } from '../../../../pos/services/pos-catalog-snapshot.service';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-pos-catalog-products-page',
  imports: [ReactiveFormsModule],
  template: `
    <div class="products-page">
      <!-- HEADER con barra decorativa -->
      <header class="page-header">
        <h2>🛍️ Productos</h2>
        <p class="page-subtitle">Administra el catálogo de productos</p>
        <div class="header-decoration"></div>
      </header>

      <!-- FORMULARIO DE CREACIÓN/EDICIÓN -->
      <form class="product-form" (submit)="onSubmit($event)">
        <div class="form-grid">
          <!-- Nombre del producto -->
          <div class="form-field">
            <label for="product-name">Nombre</label>
            <input
              id="product-name"
              type="text"
              [formControl]="nameControl"
              placeholder="Ej: Café americano, Hamburguesa"
              class="form-input"
            />
            @if (nameControl.invalid && nameControl.touched) {
              <div class="field-error">El nombre es obligatorio</div>
            }
          </div>

          <!-- Precio base -->
          <div class="form-field">
            <label for="product-price">Precio base ($)</label>
            <input
              id="product-price"
              type="number"
              min="0"
              step="0.01"
              [formControl]="basePriceControl"
              placeholder="0.00"
              class="form-input"
            />
            @if (basePriceControl.invalid && basePriceControl.touched) {
              <div class="field-error">Debe ser un número positivo</div>
            }
          </div>

          <!-- Categoría (requerida) -->
          <div class="form-field">
            <label for="product-category">Categoría</label>
            <select
              id="product-category"
              [formControl]="categoryIdControl"
              class="form-select"
            >
              <option value="" disabled>Selecciona una categoría</option>
              @for (category of categories(); track category.id) {
                <option [value]="category.id">{{ category.name }}</option>
              }
            </select>
            @if (categoryIdControl.invalid && categoryIdControl.touched) {
              <div class="field-error">Debes seleccionar una categoría</div>
            }
          </div>

          <!-- Schema de personalización (opcional) -->
          <div class="form-field">
            <label for="product-schema">Schema de personalización</label>
            <select
              id="product-schema"
              [formControl]="schemaIdControl"
              class="form-select"
            >
              <option value="">Sin schema</option>
              @for (schema of schemas(); track schema.id) {
                <option [value]="schema.id">{{ schema.name }}</option>
              }
            </select>
          </div>

          <!-- Checkbox activo -->
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

          <div class="form-field checkbox-field">
            <label class="checkbox-label">
              <input
                type="checkbox"
                [formControl]="isAvailableControl"
                class="checkbox-input"
              />
              <span class="checkbox-text">Disponible</span>
            </label>
          </div>

          <!-- Acciones del formulario -->
          <div class="form-actions">
            @if (editingId()) {
              <button type="button" class="btn-outline" (click)="resetForm()">
                Cancelar
              </button>
            }
            <button
              type="submit"
              class="btn-primary"
              [disabled]="
                nameControl.invalid ||
                basePriceControl.invalid ||
                categoryIdControl.invalid
              "
            >
              <span>{{ editingId() ? '💾' : '✨' }}</span>
              {{ editingId() ? 'Guardar cambios' : 'Crear producto' }}
            </button>
          </div>
        </div>
      </form>

      <!-- MENSAJE DE ERROR -->
      @if (errorMessage()) {
        <div class="error-message" role="alert">
          <span class="error-icon">⚠️</span>
          <span>{{ errorMessage() }}</span>
          <button
            type="button"
            class="error-dismiss"
            (click)="errorMessage.set('')"
          >
            ✕
          </button>
        </div>
      }
      @if (tenantRequiredError()) {
        <p role="alert" data-testid="platform-tenant-required-error">{{ tenantRequiredError() }}</p>
      }
      @if (availabilityForbiddenError()) {
        <p role="alert" data-testid="availability-forbidden-error">{{ availabilityForbiddenError() }}</p>
      }

      <!-- LISTA DE PRODUCTOS -->
      @if (products().length === 0) {
        <div class="empty-state">
          <span class="empty-icon">📦</span>
          <p>No hay productos creados</p>
          <p class="empty-hint">Crea tu primer producto para comenzar</p>
        </div>
      } @else {
        <div class="products-header">
          <span class="products-count">
            {{ products().length }}
            {{ products().length === 1 ? 'producto' : 'productos' }}
          </span>
        </div>

        <ul class="products-grid" aria-label="Listado de productos">
          @for (item of products(); track item.id) {
            <li class="product-card">
              <div class="product-info">
                <span class="product-icon">🛒</span>
                <div class="product-details">
                  <span class="product-name">{{ item.name }}</span>
                  <div class="product-meta">
                    <span class="product-price">$ {{ item.basePrice.toFixed(2) }}</span>
                    <span
                      class="status-badge"
                      [class.status-badge--active]="item.isActive"
                      [class.status-badge--inactive]="!item.isActive"
                    >
                      {{ item.isActive ? '✅ Activo' : '⛔ Inactivo' }}
                    </span>
                    <label>
                      <input type="checkbox" [checked]="isOverrideEnabled(item.id)" (change)="onToggleOverride(item.id, $event)" [attr.data-testid]="'override-toggle-Product-' + item.id" />
                      Ofrecer
                    </label>
                    <label>
                      <input type="checkbox" [checked]="isSnapshotAvailable('Product', item.id)" [disabled]="!isOverrideEnabled(item.id)" (change)="onToggleAvailability(item.id, $event)" [attr.data-testid]="'availability-toggle-Product-' + item.id" />
                      Disponible en sucursal
                    </label>
                  </div>
                  <div class="product-category">
                    <span class="meta-label">Categoría:</span>
                    {{ getCategoryName(item.categoryId) }}
                  </div>
                  @if (item.customizationSchemaId) {
                    <div class="product-schema">
                      <span class="meta-label">Schema:</span>
                      {{ getSchemaName(item.customizationSchemaId) }}
                    </div>
                  }
                </div>
              </div>
              <div class="product-actions">
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

    .products-page {
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
    .product-form {
      background: white;
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 1.5rem;
      box-shadow: var(--shadow-sm);
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
    .products-header {
      display: flex;
      justify-content: flex-end;
      margin-top: 0.5rem;
    }

    .products-count {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--brand-muted);
      background: rgba(243, 182, 194, 0.2);
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
    }

    /* ===== GRID DE PRODUCTOS ===== */
    .products-grid {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1rem;
    }

    .product-card {
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

    .product-card:hover {
      border-color: var(--brand-rose-strong);
      box-shadow: var(--shadow-hover);
      transform: translateY(-2px);
    }

    .product-info {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
      margin-bottom: 1rem;
    }

    .product-icon {
      font-size: 1.8rem;
      color: var(--brand-cocoa);
      opacity: 0.8;
    }

    .product-details {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      flex: 1;
    }

    .product-name {
      font-weight: 700;
      font-size: 1.1rem;
      color: var(--brand-ink);
      word-break: break-word;
    }

    .product-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .product-price {
      font-size: 1.1rem;
      font-weight: 800;
      color: var(--brand-cocoa);
      background: rgba(243, 182, 194, 0.16);
      padding: 0.2rem 0.6rem;
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

    .product-category,
    .product-schema {
      font-size: 0.8rem;
      color: var(--brand-muted);
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .meta-label {
      font-weight: 600;
      color: var(--brand-ink);
    }

    .product-actions {
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
    }

    @media (max-width: 600px) {
      .form-grid {
        grid-template-columns: 1fr;
        gap: 0.75rem;
      }

      .products-grid {
        grid-template-columns: 1fr;
      }

      .product-card {
        padding: 1rem;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsPage {
  private readonly api = inject(PosCatalogApiService);
  private readonly overridesApi = inject(PosAdminCatalogOverridesApiService);
  private readonly availabilityApi = inject(PosAdminCatalogAvailabilityApiService);
  private readonly storeContext = inject(StoreContextService);
  private readonly snapshotService = inject(PosCatalogSnapshotService);

  readonly categories = signal<CategoryDto[]>([]);
  readonly schemas = signal<SchemaDto[]>([]);
  readonly products = signal<ProductDto[]>([]);
  readonly errorMessage = signal('');
  readonly editingId = signal<string | null>(null);
  readonly overrideByItemId = signal<Record<string, boolean>>({});
  readonly snapshotAvailabilityByItemId = signal<Record<string, boolean>>({});
  readonly tenantRequiredError = signal('');
  readonly availabilityForbiddenError = signal('');

  readonly nameControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  readonly basePriceControl = new FormControl(0, {
    nonNullable: true,
    validators: [Validators.required, Validators.min(0)],
  });

  readonly categoryIdControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  readonly schemaIdControl = new FormControl('', { nonNullable: true });
  readonly isActiveControl = new FormControl(true, { nonNullable: true });
  readonly isAvailableControl = new FormControl(true, { nonNullable: true });

  constructor() {
    void this.bootstrap();
  }

  async onSubmit(event: Event) {
    event.preventDefault();

    if (
      this.nameControl.invalid ||
      this.categoryIdControl.invalid ||
      this.basePriceControl.invalid
    ) {
      this.nameControl.markAsTouched();
      this.categoryIdControl.markAsTouched();
      this.basePriceControl.markAsTouched();
      return;
    }

    this.errorMessage.set('');
    const payload = {
      externalCode: null,
      name: this.nameControl.value.trim(),
      categoryId: this.categoryIdControl.value,
      subcategoryName: null,
      basePrice: this.basePriceControl.value,
      isActive: this.isActiveControl.value,
      isAvailable: this.isAvailableControl.value,
      customizationSchemaId: this.schemaIdControl.value || null,
    };

    try {
      const id = this.editingId();
      if (id) {
        await this.api.updateProduct(id, payload);
      } else {
        await this.api.createProduct(payload);
      }
      this.resetForm();
      await Promise.all([this.loadProducts(), this.loadOverrides(), this.loadSnapshotAvailability()]);
    } catch {
      this.errorMessage.set('No fue posible guardar el producto.');
    }
  }

  onEdit(item: ProductDto) {
    this.editingId.set(item.id);
    this.nameControl.setValue(item.name);
    this.basePriceControl.setValue(item.basePrice);
    this.categoryIdControl.setValue(item.categoryId);
    this.schemaIdControl.setValue(item.customizationSchemaId ?? '');
    this.isActiveControl.setValue(item.isActive);
    this.isAvailableControl.setValue(item.isAvailable);
  }

  isOverrideEnabled(itemId: string) {
    return this.overrideByItemId()[itemId] ?? true;
  }

  isSnapshotAvailable(itemType: string, itemId: string) {
    if (itemType !== 'Product') {
      return true;
    }

    return this.snapshotAvailabilityByItemId()[itemId] ?? true;
  }

  async onToggleOverride(itemId: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.tenantRequiredError.set('');

    try {
      const storeId = this.storeContext.getActiveStoreId();
    if (!storeId) { return; }
      await this.overridesApi.upsertOverride({ storeId, itemType: 'Product', itemId, state: checked ? 'Enabled' : 'Disabled' });
      this.overrideByItemId.update((current) => ({ ...current, [itemId]: checked }));
      this.snapshotService.invalidate();
      await this.loadSnapshotAvailability();
    } catch (error: unknown) {
      this.handlePosAdminError(error);
    }
  }

  async onToggleAvailability(itemId: string, event: Event) {
    const storeId = this.storeContext.getActiveStoreId();
    if (!storeId) {
      return;
    }

    const checked = (event.target as HTMLInputElement).checked;
    this.availabilityForbiddenError.set('');

    try {
      await this.availabilityApi.upsertAvailability({ storeId, itemType: 'Product', itemId, isAvailable: checked });
      this.snapshotService.invalidate(storeId);
      await this.loadSnapshotAvailability();
    } catch (error: unknown) {
      this.handlePosAdminError(error);
    }
  }

  async onDeactivate(item: ProductDto) {
    if (!item.isActive) return;

    this.errorMessage.set('');
    try {
      await this.api.deactivateProduct(item.id);
      await Promise.all([this.loadProducts(), this.loadOverrides(), this.loadSnapshotAvailability()]);
    } catch {
      this.errorMessage.set('No fue posible desactivar el producto.');
    }
  }

  getCategoryName(categoryId: string): string {
    return this.categories().find((c) => c.id === categoryId)?.name ?? '—';
  }

  getSchemaName(schemaId: string): string {
    return this.schemas().find((s) => s.id === schemaId)?.name ?? '—';
  }

  resetForm() {
    this.editingId.set(null);
    this.nameControl.setValue('');
    this.basePriceControl.setValue(0);
    this.schemaIdControl.setValue('');
    this.isActiveControl.setValue(true);
    this.isAvailableControl.setValue(true);
    this.nameControl.markAsUntouched();
    this.categoryIdControl.markAsUntouched();
    this.basePriceControl.markAsUntouched();

    // Restaurar primera categoría si existe
    if (this.categories().length > 0) {
      this.categoryIdControl.setValue(this.categories()[0].id);
    } else {
      this.categoryIdControl.setValue('');
    }
  }

  private async bootstrap() {
    try {
      const [categories, schemas] = await Promise.all([
        this.api.getCategories(true),
        this.api.getSchemas(true),
      ]);
      this.categories.set(categories);
      this.schemas.set(schemas);

      if (categories.length > 0) {
        this.categoryIdControl.setValue(categories[0].id);
      }

      await Promise.all([this.loadProducts(), this.loadOverrides(), this.loadSnapshotAvailability()]);
    } catch {
      this.errorMessage.set('No fue posible cargar catálogos base.');
    }
  }


  private async loadOverrides() {
    try {
      const storeId = this.storeContext.getActiveStoreId();
      if (!storeId) {
        this.overrideByItemId.set({});
        return;
      }
      const overrides = await this.overridesApi.listOverrides(storeId, 'Product');
      this.overrideByItemId.set(
        overrides.reduce<Record<string, boolean>>((acc, item) => ({ ...acc, [item.itemId]: item.state === 'Enabled' }), {}),
      );
    } catch {
      this.overrideByItemId.set({});
    }
  }

  private async loadSnapshotAvailability() {
    try {
      const snapshot = await firstValueFrom(this.snapshotService.getSnapshot({ forceRefresh: true }));
      const map = (snapshot?.products ?? []).reduce<Record<string, boolean>>(
        (acc, item) => ({ ...acc, [item.id]: item.isAvailable }),
        {},
      );
      this.snapshotAvailabilityByItemId.set(map);
    } catch {
      this.snapshotAvailabilityByItemId.set({});
    }
  }

  private handlePosAdminError(error: unknown) {
    if (error instanceof HttpErrorResponse && error.status === 400) {
      this.tenantRequiredError.set('Selecciona Tenant en Plataforma para operar POS Admin.');
      return;
    }

    if (error instanceof HttpErrorResponse && error.status === 403) {
      this.availabilityForbiddenError.set('La sucursal no pertenece al tenant seleccionado.');
      return;
    }

    this.errorMessage.set('No fue posible actualizar estado POS Admin.');
  }

  private async loadProducts() {
    try {
      this.products.set(await this.api.getProducts(true));
    } catch {
      this.errorMessage.set('No fue posible cargar los productos.');
    }
  }
}
