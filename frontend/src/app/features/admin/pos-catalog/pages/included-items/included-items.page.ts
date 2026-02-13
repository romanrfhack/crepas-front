import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ExtraDto, IncludedItemDto, ProductDto } from '../../models/pos-catalog.models';
import { PosCatalogApiService } from '../../services/pos-catalog-api.service';

@Component({
  selector: 'app-pos-catalog-included-items-page',
  imports: [ReactiveFormsModule],
  template: `
    <div class="included-items-page">
      <!-- HEADER con barra decorativa -->
      <header class="page-header">
        <h2>&#128230; Included items</h2>
        <p class="page-subtitle">Administra extras incluidos por defecto en cada producto</p>
        <div class="header-decoration"></div>
      </header>

      <!-- TARJETA PRINCIPAL: SELECTOR DE PRODUCTO Y FORMULARIO -->
      <div class="section-card">
        <div class="section-header">
          <span class="section-icon">&#128722;</span>
          <h3>Configuración de producto</h3>
        </div>

        <!-- Selector de producto -->
        <div class="product-selector">
          <div class="form-field">
            <label for="product-selector">Producto</label>
            <div class="select-wrapper">
              <select
                id="product-selector"
                [formControl]="productIdControl"
                class="form-select"
              >
                @for (item of products(); track item.id) {
                  <option [value]="item.id">{{ item.name }}</option>
                }
              </select>
            </div>
            @if (products().length === 0) {
              <div class="field-hint">
                &#9432; No hay productos activos. Crea uno primero.
              </div>
            }
          </div>
        </div>

        @if (productIdControl.value) {
          <!-- Formulario para agregar/actualizar extra incluido -->
          <form class="add-form" (submit)="onAddRow($event)">
            <div class="form-grid">
              <div class="form-field">
                <label for="extra-selector">Extra</label>
                <div class="select-wrapper">
                  <select
                    id="extra-selector"
                    [formControl]="extraIdControl"
                    class="form-select"
                  >
                    @for (item of extras(); track item.id) {
                      <option [value]="item.id">{{ item.name }}</option>
                    }
                  </select>
                </div>
              </div>

              <div class="form-field">
                <label for="extra-quantity">Cantidad</label>
                <input
                  id="extra-quantity"
                  type="number"
                  min="1"
                  [formControl]="quantityControl"
                  placeholder="1"
                  class="form-input"
                />
                @if (quantityControl.invalid && quantityControl.touched) {
                  <div class="field-error">Mínimo 1</div>
                }
              </div>

              <div class="form-actions">
                <button
                  type="submit"
                  class="btn-primary"
                  [disabled]="
                    extraIdControl.invalid ||
                    quantityControl.invalid ||
                    extras().length === 0
                  "
                >
                  &#10133; Agregar / Actualizar
                </button>
              </div>
            </div>
          </form>
        }
      </div>

      <!-- MENSAJE DE ERROR -->
      @if (errorMessage()) {
        <div class="error-message" role="alert">
          <span class="error-icon">&#9888;</span>
          <span>{{ errorMessage() }}</span>
          <button
            type="button"
            class="error-dismiss"
            (click)="errorMessage.set('')"
          >
            &#10005;
          </button>
        </div>
      }

      <!-- LISTA DE INCLUDED ITEMS (solo si hay producto seleccionado) -->
      @if (productIdControl.value) {
        <div class="section-card">
          <div class="section-header">
            <span class="section-icon">&#128221;</span>
            <h3>Extras incluidos actualmente</h3>
            @if (rows().length > 0) {
              <span class="count-badge">
                {{ rows().length }} {{ rows().length === 1 ? 'ítem' : 'ítems' }}
              </span>
            }
          </div>

          @if (rows().length === 0) {
            <div class="empty-state">
              <span class="empty-icon">&#128230;</span>
              <p>No hay extras incluidos para este producto</p>
              <p class="empty-hint">Agrega extras desde el formulario superior</p>
            </div>
          } @else {
            <ul class="items-grid" aria-label="Lista de extras incluidos">
              @for (row of rows(); track row.extraId) {
                <li class="item-card">
                  <div class="item-info">
                    <span class="item-icon">&#127831;</span>
                    <div class="item-details">
                      <span class="item-name">{{ getExtraName(row.extraId) }}</span>
                      <div class="item-meta">
                        <span class="item-quantity">&#10005; {{ row.quantity }}</span>
                      </div>
                    </div>
                  </div>
                  <div class="item-actions">
                    <button
                      type="button"
                      class="btn-outline btn-danger btn-small"
                      (click)="onRemoveRow(row.extraId)"
                      aria-label="Quitar extra"
                    >
                      &#128465; Quitar
                    </button>
                  </div>
                </li>
              }
            </ul>
          }

          <!-- Botón de guardar (reemplaza toda la lista) -->
          @if (rows().length > 0 || true) {
            <div class="save-section">
              <button
                type="button"
                class="btn-primary"
                [disabled]="!canSave()"
                (click)="onSave()"
              >
                &#128190; Guardar included items
              </button>
              <span class="save-hint">
                &#9432; Se reemplaza la lista completa del producto seleccionado.
              </span>
            </div>
          }
        </div>
      } @else {
        <!-- Mensaje cuando no hay producto seleccionado (raro) -->
        <div class="empty-state">
          <span class="empty-icon">&#128722;</span>
          <p>Selecciona un producto para administrar sus included items</p>
        </div>
      }
    </div>
  `,
  styles: [`
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

    .included-items-page {
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

    /* ===== SELECTOR DE PRODUCTO ===== */
    .product-selector {
      max-width: 500px;
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

    .select-wrapper {
      width: 100%;
    }

    .form-select,
    .form-input {
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

    .form-select:hover,
    .form-input:hover {
      border-color: rgba(232, 154, 172, 0.45);
    }

    .form-select:focus-visible,
    .form-input:focus-visible {
      outline: 3px solid var(--ring);
      outline-offset: 1px;
      border-color: rgba(232, 154, 172, 0.55);
      box-shadow: 0 0 0 4px rgba(232, 154, 172, 0.16);
    }

    .field-hint {
      font-size: 0.8rem;
      color: var(--brand-muted);
      margin-top: 0.25rem;
    }

    .field-error {
      font-size: 0.75rem;
      color: #b42318;
      margin-top: 0.1rem;
      padding-left: 0.5rem;
    }

    /* ===== FORMULARIO DE AGREGAR ===== */
    .add-form {
      margin-top: 0.5rem;
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr auto;
      gap: 1rem;
      align-items: flex-end;
    }

    .form-actions {
      display: flex;
      gap: 0.5rem;
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

    /* ===== GRID DE ITEMS ===== */
    .items-grid {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }

    .item-card {
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

    .item-card:hover {
      border-color: var(--brand-rose-strong);
      box-shadow: var(--shadow-hover);
      transform: translateY(-2px);
    }

    .item-info {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
      margin-bottom: 1rem;
    }

    .item-icon {
      font-size: 1.8rem;
      color: var(--brand-cocoa);
      opacity: 0.8;
    }

    .item-details {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      flex: 1;
    }

    .item-name {
      font-weight: 700;
      font-size: 1.1rem;
      color: var(--brand-ink);
      word-break: break-word;
    }

    .item-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .item-quantity {
      font-size: 1rem;
      font-weight: 600;
      color: var(--brand-muted);
      background: rgba(243, 182, 194, 0.16);
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
    }

    .item-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: auto;
      padding-top: 0.75rem;
      border-top: 1px solid var(--border);
    }

    /* ===== SECCIÓN DE GUARDADO ===== */
    .save-section {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;
      margin-top: 0.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
    }

    .save-hint {
      font-size: 0.85rem;
      color: var(--brand-muted);
      display: flex;
      align-items: center;
      gap: 0.35rem;
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

      .save-section {
        flex-direction: column;
        align-items: flex-start;
      }
    }

    @media (max-width: 600px) {
      .section-card {
        padding: 1.25rem;
      }

      .form-grid {
        grid-template-columns: 1fr;
      }

      .form-actions {
        grid-column: span 1;
      }

      .btn-primary {
        width: 100%;
      }

      .items-grid {
        grid-template-columns: 1fr;
      }

      .item-card {
        padding: 1rem;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncludedItemsPage {
  private readonly api = inject(PosCatalogApiService);

  readonly products = signal<ProductDto[]>([]);
  readonly extras = signal<ExtraDto[]>([]);
  readonly includedItems = signal<IncludedItemDto[]>([]);
  readonly localRows = signal<Record<string, number>>({});
  readonly errorMessage = signal('');

  readonly productIdControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  readonly extraIdControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  readonly quantityControl = new FormControl(1, {
    nonNullable: true,
    validators: [Validators.required, Validators.min(1)],
  });

  readonly rows = computed(() =>
    Object.entries(this.localRows()).map(([extraId, quantity]) => ({ extraId, quantity })),
  );

  readonly canSave = computed(() => this.productIdControl.valid);

  constructor() {
    this.productIdControl.valueChanges.subscribe(() => {
      void this.loadIncludedItems();
    });
    void this.bootstrap();
  }

  async onAddRow(event: Event) {
    event.preventDefault();
    if (this.extraIdControl.invalid || this.quantityControl.invalid) {
      this.extraIdControl.markAsTouched();
      this.quantityControl.markAsTouched();
      return;
    }

    this.localRows.update((current) => ({
      ...current,
      [this.extraIdControl.value]: this.quantityControl.value,
    }));

    // Reset quantity to 1 after adding, but keep selected extra
    this.quantityControl.setValue(1);
    this.quantityControl.markAsUntouched();
  }

  onRemoveRow(extraId: string) {
    this.localRows.update((current) => {
      const updated = { ...current };
      delete updated[extraId];
      return updated;
    });
  }

  async onSave() {
    const productId = this.productIdControl.value;
    if (!productId) {
      return;
    }

    this.errorMessage.set('');
    try {
      const saved = await this.api.replaceIncludedItems(productId, {
        items: this.rows().map((row) => ({ extraId: row.extraId, quantity: row.quantity })),
      });
      this.includedItems.set(saved);
      // No need to update localRows because they already reflect the saved state
    } catch {
      this.errorMessage.set('No fue posible guardar los included items.');
    }
  }

  getExtraName(extraId: string): string {
    return this.extras().find((item) => item.id === extraId)?.name ?? extraId;
  }

  private async bootstrap() {
    try {
      const [products, extras] = await Promise.all([
        this.api.getProducts(true),
        this.api.getExtras(true),
      ]);
      this.products.set(products);
      this.extras.set(extras);

      if (products.length > 0) {
        this.productIdControl.setValue(products[0].id);
      }
      if (extras.length > 0) {
        this.extraIdControl.setValue(extras[0].id);
      }
      await this.loadIncludedItems();
    } catch {
      this.errorMessage.set('No fue posible cargar productos/extras.');
    }
  }

  private async loadIncludedItems() {
    const productId = this.productIdControl.value;
    if (!productId) {
      this.includedItems.set([]);
      this.localRows.set({});
      return;
    }

    try {
      const items = await this.api.getIncludedItems(productId);
      this.includedItems.set(items);
      this.localRows.set(
        items.reduce<Record<string, number>>((acc, row) => {
          acc[row.extraId] = row.quantity;
          return acc;
        }, {}),
      );
    } catch {
      this.errorMessage.set('No fue posible cargar los included items.');
    }
  }
}