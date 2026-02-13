import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { OptionItemDto, ProductDto, SchemaDto, SelectionGroupDto } from '../../models/pos-catalog.models';
import { PosCatalogApiService } from '../../services/pos-catalog-api.service';

@Component({
  selector: 'app-pos-catalog-overrides-page',
  imports: [ReactiveFormsModule],
  template: `
    <div class="overrides-page">
      <!-- HEADER con barra decorativa -->
      <header class="page-header">
        <h2>&#9881;&#65039; Overrides por producto</h2>
        <p class="page-subtitle">Configura excepciones en las opciones permitidas por grupo</p>
        <div class="header-decoration"></div>
      </header>

      @if (products().length === 0 || schemas().length === 0) {
        <div class="empty-state">
          <span class="empty-icon">&#128295;</span>
          <p>No hay datos suficientes</p>
          <p class="empty-hint">Necesitas productos, schemas y grupos configurados</p>
        </div>
      } @else {
        <!-- TARJETA: SELECCIÓN DE PRODUCTO Y GRUPO -->
        <div class="section-card">
          <div class="section-header">
            <span class="section-icon">&#128722;</span>
            <h3>Selecciona producto y grupo</h3>
          </div>

          <div class="selector-grid">
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
            </div>

            <div class="form-field">
              <label for="group-selector">Grupo (key)</label>
              <div class="select-wrapper">
                <select
                  id="group-selector"
                  [formControl]="groupKeyControl"
                  class="form-select"
                >
                  @for (group of productGroups(); track group.id) {
                    <option [value]="group.key">
                      {{ group.label }} ({{ group.key }})
                    </option>
                  }
                </select>
              </div>
              @if (productGroups().length === 0) {
                <div class="field-hint">
                  &#9432; Este producto no tiene grupos de personalización.
                </div>
              }
            </div>
          </div>
        </div>

        <!-- TARJETA: CONFIGURACIÓN DE ALLOWED ITEMS (si hay grupo seleccionado) -->
        @if (groupKeyControl.value && productGroups().length > 0) {
          <div class="section-card">
            <div class="section-header">
              <span class="section-icon">&#128279;</span>
              <h3>Opciones permitidas para "{{ getGroupLabel() }}"</h3>
              <span class="count-badge">
                {{ selectedCount() }} / {{ availableItems().length }} seleccionadas
              </span>
            </div>

            <fieldset class="options-fieldset">
              <legend class="sr-only">Opciones disponibles</legend>
              @if (availableItems().length === 0) {
                <div class="empty-state small">
                  <span class="empty-icon">&#128230;</span>
                  <p>No hay opciones en este grupo</p>
                </div>
              } @else {
                <div class="options-grid">
                  @for (item of availableItems(); track item.id) {
                    <label
                      class="option-item"
                      [class.option-item--selected]="isAllowed(item.id)"
                    >
                      <input
                        type="checkbox"
                        [checked]="isAllowed(item.id)"
                        (change)="toggleAllowed(item.id, $event)"
                        class="option-checkbox"
                      />
                      <span class="option-label">{{ item.name }}</span>
                    </label>
                  }
                </div>
              }
            </fieldset>

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

            <!-- ACCIONES -->
            <div class="save-section">
              <button
                type="button"
                class="btn-primary"
                [disabled]="
                  productIdControl.invalid ||
                  groupKeyControl.invalid ||
                  productGroups().length === 0
                "
                (click)="onSave()"
              >
                &#128190; Guardar override
              </button>
              <span class="save-hint">
                &#9432; Guarda la lista de opciones permitidas para este grupo.
                Si no seleccionas ninguna, se aplicará el valor por defecto.
              </span>
            </div>
          </div>
        }
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

    .overrides-page {
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

    /* ===== SELECTORES ===== */
    .selector-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
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

    .field-hint {
      font-size: 0.8rem;
      color: var(--brand-muted);
      margin-top: 0.25rem;
    }

    /* ===== OPCIONES EN CHECKBOX (estilo píldora) ===== */
    .options-fieldset {
      border: none;
      padding: 0;
      margin: 0;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      border: 0;
    }

    .options-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 0.65rem;
    }

    .option-item {
      display: flex;
      align-items: center;
      background: white;
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 0.4rem 0.4rem 0.4rem 1rem;
      transition: all var(--transition);
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.02);
    }

    .option-item:hover {
      border-color: var(--brand-rose-strong);
      background: rgba(243, 182, 194, 0.06);
      transform: translateY(-1px);
      box-shadow: 0 8px 16px rgba(201, 141, 106, 0.12);
    }

    .option-item--selected {
      background: linear-gradient(135deg, var(--brand-rose-strong), #c98d6a);
      border-color: transparent;
      color: white;
      box-shadow: 0 8px 20px rgba(201, 141, 106, 0.3);
    }

    .option-item--selected:hover {
      background: linear-gradient(135deg, #d88b9c, #b87a5a);
      box-shadow: 0 12px 26px rgba(201, 141, 106, 0.4);
    }

    .option-checkbox {
      width: 18px;
      height: 18px;
      margin: 0 0.65rem 0 0;
      accent-color: var(--brand-rose-strong);
      cursor: pointer;
      flex-shrink: 0;
    }

    .option-item--selected .option-checkbox {
      accent-color: white;
      filter: brightness(0) invert(1);
    }

    .option-label {
      flex: 1;
      font-weight: 500;
      font-size: 0.95rem;
      color: var(--brand-ink);
      padding: 0.3rem 0;
      cursor: pointer;
    }

    .option-item--selected .option-label {
      color: white;
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

    .empty-state.small {
      padding: 1.5rem;
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
      .selector-grid {
        grid-template-columns: 1fr;
        gap: 1rem;
      }

      .options-grid {
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      }
    }

    @media (max-width: 600px) {
      .section-card {
        padding: 1.25rem;
      }

      .options-grid {
        grid-template-columns: 1fr;
      }

      .btn-primary {
        width: 100%;
      }

      .save-section {
        flex-direction: column;
        align-items: flex-start;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverridesPage {
  private readonly api = inject(PosCatalogApiService);

  readonly products = signal<ProductDto[]>([]);
  readonly schemas = signal<SchemaDto[]>([]);
  readonly groupsBySchema = signal<Record<string, SelectionGroupDto[]>>({});
  readonly optionItemsBySet = signal<Record<string, OptionItemDto[]>>({});
  readonly allowed = signal<Record<string, boolean>>({});
  readonly errorMessage = signal('');

  readonly productIdControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  readonly groupKeyControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  readonly selectedProduct = computed(() =>
    this.products().find((item) => item.id === this.productIdControl.value) ?? null,
  );

  readonly productGroups = computed(() => {
    const schemaId = this.selectedProduct()?.customizationSchemaId;
    return schemaId ? this.groupsBySchema()[schemaId] ?? [] : [];
  });

  readonly availableItems = computed(() => {
    const group = this.productGroups().find((item) => item.key === this.groupKeyControl.value);
    if (!group) {
      return [];
    }
    return this.optionItemsBySet()[group.optionSetId] ?? [];
  });

  readonly selectedCount = computed(() => {
    return Object.values(this.allowed()).filter(Boolean).length;
  });

  constructor() {
    this.productIdControl.valueChanges.subscribe(() => {
      const firstGroup = this.productGroups()[0];
      this.groupKeyControl.setValue(firstGroup?.key ?? '');
      this.allowed.set({});
    });

    this.groupKeyControl.valueChanges.subscribe(() => {
      this.allowed.set({});
    });

    void this.bootstrap();
  }

  /** Obtiene la etiqueta del grupo seleccionado */
  getGroupLabel(): string {
    const group = this.productGroups().find((g) => g.key === this.groupKeyControl.value);
    return group?.label ?? '';
  }

  isAllowed(optionItemId: string): boolean {
    return this.allowed()[optionItemId] ?? false;
  }

  toggleAllowed(optionItemId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.allowed.update((current) => ({ ...current, [optionItemId]: checked }));
  }

  async onSave(): Promise<void> {
    const productId = this.productIdControl.value;
    const groupKey = this.groupKeyControl.value;
    if (!productId || !groupKey) {
      return;
    }

    this.errorMessage.set('');
    try {
      await this.api.upsertOverride(productId, groupKey, {
        allowedOptionItemIds: Object.entries(this.allowed())
          .filter(([, checked]) => checked)
          .map(([id]) => id),
      });
      // Opcional: mostrar mensaje de éxito breve
    } catch {
      this.errorMessage.set('No fue posible guardar el override.');
    }
  }

  private async bootstrap(): Promise<void> {
    try {
      const [products, schemas] = await Promise.all([
        this.api.getProducts(true),
        this.api.getSchemas(true),
      ]);
      this.products.set(products);
      this.schemas.set(schemas);

      // Cargar grupos por schema y opciones por grupo
      for (const schema of schemas) {
        const groups = await this.api.getGroups(schema.id, true);
        this.groupsBySchema.update((current) => ({ ...current, [schema.id]: groups }));

        for (const group of groups) {
          if (this.optionItemsBySet()[group.optionSetId]) {
            continue;
          }
          const items = await this.api.getOptionItems(group.optionSetId, true);
          this.optionItemsBySet.update((current) => ({ ...current, [group.optionSetId]: items }));
        }
      }

      // Seleccionar primer producto por defecto
      if (products.length > 0) {
        this.productIdControl.setValue(products[0].id);
      }
    } catch {
      this.errorMessage.set('No fue posible cargar los datos para overrides.');
    }
  }
}