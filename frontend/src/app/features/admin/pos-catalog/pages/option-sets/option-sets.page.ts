import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { OptionItemDto, OptionSetDto } from '../../models/pos-catalog.models';
import { PosCatalogApiService } from '../../services/pos-catalog-api.service';
import { PosAdminCatalogOverridesApiService } from '../../services/pos-admin-catalog-overrides-api.service';
import { PosAdminCatalogAvailabilityApiService } from '../../services/pos-admin-catalog-availability-api.service';
import { StoreContextService } from '../../../../pos/services/store-context.service';

@Component({
  selector: 'app-pos-catalog-option-sets-page',
  imports: [ReactiveFormsModule],
  template: `
    <div class="option-sets-page">
      <!-- HEADER con barra decorativa -->
      <header class="page-header">
        <h2>&#9881;&#65039; Option sets e items</h2>
        <p class="page-subtitle">Administra conjuntos de opciones y sus valores</p>
        <div class="header-decoration"></div>
      </header>

      <!-- SECCIÓN: ADMINISTRAR OPTION SETS -->
      <div class="section-card">
        <div class="section-header">
          <span class="section-icon">&#128193;</span>
          <h3>Option sets</h3>
        </div>

        <!-- Formulario para crear Option Set -->
        <form class="inline-form" (submit)="onSubmitSet($event)">
          <div class="inline-form-fields">
            <div class="form-field">
              <label for="set-name">Nombre del option set</label>
              <input
                id="set-name"
                type="text"
                [formControl]="setNameControl"
                placeholder="Ej: Tamaño, Tipo de leche"
                class="form-input"
              />
              @if (setNameControl.invalid && setNameControl.touched) {
                <div class="field-error">El nombre es obligatorio</div>
              }
            </div>
            <div class="form-field checkbox-field">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  [formControl]="setIsActiveControl"
                  class="checkbox-input"
                />
                <span class="checkbox-text">Activo</span>
              </label>
            </div>
          </div>
          <div class="form-actions">
            <button
              type="submit"
              class="btn-primary"
              [disabled]="setNameControl.invalid"
            >
              &#10024; Crear option set
            </button>
          </div>
        </form>

        <!-- Selector de Option Set -->
        <div class="selector-field">
          <label for="set-selector">Option set seleccionado</label>
          <div class="select-wrapper">
            <select
              id="set-selector"
              [formControl]="selectedSetIdControl"
              class="form-select"
            >
              @for (item of optionSets(); track item.id) {
                <option [value]="item.id">{{ item.name }}</option>
              }
            </select>
          </div>
          @if (optionSets().length === 0) {
            <div class="field-hint">
              &#9432; No hay option sets. Crea uno para comenzar.
            </div>
          }
        </div>
      </div>

      <!-- SECCIÓN: ADMINISTRAR ITEMS -->
      @if (selectedSetIdControl.value) {
        <div class="section-card">
          <div class="section-header">
            <span class="section-icon">&#128722;</span>
            <h3>Items de: {{ getSelectedSetName() }}</h3>
            @if (optionItems().length > 0) {
              <span class="items-count">
                {{ optionItems().length }} {{ optionItems().length === 1 ? 'item' : 'items' }}
              </span>
            }
          </div>

          <!-- Formulario para crear/editar Item -->
          <form class="inline-form" (submit)="onSubmitItem($event)">
            <div class="inline-form-fields">
              <div class="form-field">
                <label for="item-name">Nombre del item</label>
                <input
                  id="item-name"
                  type="text"
                  [formControl]="itemNameControl"
                  placeholder="Ej: Grande, Deslactosada"
                  class="form-input"
                />
                @if (itemNameControl.invalid && itemNameControl.touched) {
                  <div class="field-error">El nombre es obligatorio</div>
                }
              </div>
              <div class="form-field">
                <label for="item-order">Orden</label>
                <input
                  id="item-order"
                  type="number"
                  min="0"
                  [formControl]="itemSortOrderControl"
                  placeholder="0"
                  class="form-input"
                />
                @if (itemSortOrderControl.invalid && itemSortOrderControl.touched) {
                  <div class="field-error">Debe ser un número positivo</div>
                }
              </div>
              <div class="form-field checkbox-field">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    [formControl]="itemIsActiveControl"
                    class="checkbox-input"
                  />
                  <span class="checkbox-text">Activo</span>
                </label>
              </div>
              <div class="form-field checkbox-field">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    [formControl]="itemIsAvailableControl"
                    class="checkbox-input"
                  />
                  <span class="checkbox-text">Disponible</span>
                </label>
              </div>
            </div>
            <div class="form-actions">
              @if (editingItemId()) {
                <button
                  type="button"
                  class="btn-outline"
                  (click)="cancelItemEdit()"
                >
                  Cancelar
                </button>
              }
              <button
                type="submit"
                class="btn-primary"
                [disabled]="
                  itemNameControl.invalid ||
                  itemSortOrderControl.invalid
                "
              >
                <span>{{ editingItemId() ? '&#128190;' : '&#10024;' }}</span>
                {{ editingItemId() ? 'Guardar item' : 'Crear item' }}
              </button>
            </div>
          </form>

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

          <!-- LISTA DE ITEMS -->
          @if (optionItems().length === 0) {
            <div class="empty-state">
              <span class="empty-icon">&#128230;</span>
              <p>No hay items en este option set</p>
              <p class="empty-hint">Crea un item para comenzar</p>
            </div>
          } @else {
            <ul class="items-grid" aria-label="Listado de items">
              @for (item of optionItems(); track item.id) {
                <li class="item-card">
                  <div class="item-info">
                    <span class="item-icon">&#128279;</span>
                    <div class="item-details">
                      <span class="item-name">{{ item.name }}</span>
                      <div class="item-meta">
                        <span class="item-order">#{{ item.sortOrder }}</span>
                        <span
                          class="status-badge"
                          [class.status-badge--active]="item.isActive"
                          [class.status-badge--inactive]="!item.isActive"
                        >
                          {{ item.isActive ? '&#9989; Activo' : '&#9940; Inactivo' }}
                        </span>
                        <label>
                          <input type="checkbox" [checked]="isEnabled(item.id)" (change)="onToggleItemOverride(item.id, $event)" [attr.data-testid]="'override-toggle-OptionItem-' + item.id" />
                          Ofrecer
                        </label>
                        <label>
                          <input type="checkbox" [checked]="item.isAvailable" [disabled]="!isEnabled(item.id)" (change)="onToggleItemAvailability(item, $event)" [attr.data-testid]="'availability-toggle-OptionItem-' + item.id" />
                          Disponible en sucursal
                        </label>
                      </div>
                    </div>
                  </div>
                  <div class="item-actions">
                    <button
                      type="button"
                      class="btn-outline btn-small"
                      (click)="onEditItem(item)"
                    >
                      &#9998; Editar
                    </button>
                    <button
                      type="button"
                      class="btn-outline btn-danger btn-small"
                      (click)="onDeactivateItem(item)"
                      [disabled]="!item.isActive"
                    >
                      &#128465; Desactivar
                    </button>
                  </div>
                </li>
              }
            </ul>
          }
        </div>
      } @else {
        <!-- Mensaje cuando no hay option set seleccionado (rara vez ocurre) -->
        <div class="empty-state">
          <span class="empty-icon">&#9881;</span>
          <p>Selecciona un option set para administrar sus items</p>
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

    .option-sets-page {
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

    .items-count {
      margin-left: auto;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--brand-muted);
      background: rgba(243, 182, 194, 0.2);
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
    }

    /* ===== FORMULARIOS ===== */
    .inline-form {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 1rem;
      width: 100%;
    }

    .inline-form-fields {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      flex: 1;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      flex: 1 1 200px;
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

    .field-hint {
      font-size: 0.8rem;
      color: var(--brand-muted);
      margin-top: 0.25rem;
    }

    .form-actions {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      flex-shrink: 0;
    }

    /* ===== SELECTOR ESPECIAL ===== */
    .selector-field {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      margin-top: 0.5rem;
    }

    .selector-field label {
      font-weight: 600;
      font-size: 0.85rem;
      color: var(--brand-ink);
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }

    .select-wrapper {
      max-width: 400px;
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
      padding: 2rem 1.5rem;
      text-align: center;
      background: rgba(243, 182, 194, 0.08);
      border: 1px dashed var(--border);
      border-radius: var(--radius-lg);
      color: var(--brand-muted);
    }

    .empty-icon {
      font-size: 2rem;
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
      font-size: 1.5rem;
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
      font-size: 1rem;
      color: var(--brand-ink);
      word-break: break-word;
    }

    .item-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .item-order {
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

    .item-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: auto;
      padding-top: 0.75rem;
      border-top: 1px solid var(--border);
    }

    /* ===== RESPONSIVE ===== */
    @media (max-width: 900px) {
      .inline-form {
        flex-direction: column;
        align-items: stretch;
      }

      .inline-form-fields {
        flex-direction: column;
      }

      .form-actions {
        justify-content: flex-end;
      }
    }

    @media (max-width: 600px) {
      .section-card {
        padding: 1.25rem;
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
export class OptionSetsPage {
  private readonly api = inject(PosCatalogApiService);
  private readonly overridesApi = inject(PosAdminCatalogOverridesApiService);
  private readonly availabilityApi = inject(PosAdminCatalogAvailabilityApiService);
  private readonly storeContext = inject(StoreContextService);

  readonly optionSets = signal<OptionSetDto[]>([]);
  readonly optionItems = signal<OptionItemDto[]>([]);
  readonly errorMessage = signal('');
  readonly editingItemId = signal<string | null>(null);
  readonly overrideByItemId = signal<Record<string, boolean>>({});

  readonly setNameControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  readonly setIsActiveControl = new FormControl(true, { nonNullable: true });

  readonly selectedSetIdControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  readonly itemNameControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  readonly itemSortOrderControl = new FormControl(0, {
    nonNullable: true,
    validators: [Validators.min(0)],
  });

  readonly itemIsActiveControl = new FormControl(true, { nonNullable: true });
  readonly itemIsAvailableControl = new FormControl(true, { nonNullable: true });

  constructor() {
    this.selectedSetIdControl.valueChanges.subscribe(() => {
      void this.loadItems();
    });
    void this.loadSets();
  }

  /** Obtiene el nombre del option set seleccionado */
  getSelectedSetName(): string {
    const setId = this.selectedSetIdControl.value;
    const set = this.optionSets().find(s => s.id === setId);
    return set?.name ?? '';
  }

  async onSubmitSet(event: Event) {
    event.preventDefault();
    if (this.setNameControl.invalid) {
      this.setNameControl.markAsTouched();
      return;
    }

    try {
      await this.api.createOptionSet({
        name: this.setNameControl.value.trim(),
        isActive: this.setIsActiveControl.value,
      });
      this.setNameControl.setValue('');
      this.setIsActiveControl.setValue(true);
      this.setNameControl.markAsUntouched();
      await this.loadSets();
    } catch {
      this.errorMessage.set('No fue posible guardar el option set.');
    }
  }

  async onSubmitItem(event: Event) {
    event.preventDefault();
    const setId = this.selectedSetIdControl.value;
    if (
      !setId ||
      this.itemNameControl.invalid ||
      this.itemSortOrderControl.invalid
    ) {
      this.itemNameControl.markAsTouched();
      this.itemSortOrderControl.markAsTouched();
      return;
    }

    try {
      const payload = {
        name: this.itemNameControl.value.trim(),
        sortOrder: this.itemSortOrderControl.value,
        isActive: this.itemIsActiveControl.value,
        isAvailable: this.itemIsAvailableControl.value,
      };
      const itemId = this.editingItemId();
      if (itemId) {
        await this.api.updateOptionItem(setId, itemId, payload);
      } else {
        await this.api.createOptionItem(setId, payload);
      }
      this.cancelItemEdit();
      await this.loadItems();
    } catch {
      this.errorMessage.set('No fue posible guardar el item.');
    }
  }

  onEditItem(item: OptionItemDto) {
    this.editingItemId.set(item.id);
    this.itemNameControl.setValue(item.name);
    this.itemSortOrderControl.setValue(item.sortOrder);
    this.itemIsActiveControl.setValue(item.isActive);
    this.itemIsAvailableControl.setValue(item.isAvailable);
  }


  isEnabled(itemId: string) {
    return this.overrideByItemId()[itemId] ?? true;
  }

  async onToggleItemOverride(itemId: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    await this.overridesApi.upsertOverride({ itemType: 'OptionItem', itemId, isEnabled: checked });
    this.overrideByItemId.update((current) => ({ ...current, [itemId]: checked }));
  }

  async onToggleItemAvailability(item: OptionItemDto, event: Event) {
    const setId = this.selectedSetIdControl.value;
    if (!setId) {
      return;
    }

    const previous = item.isAvailable;
    const targetAvailability = (event.target as HTMLInputElement).checked;
    this.optionItems.update((items) =>
      items.map((current) =>
        current.id === item.id ? { ...current, isAvailable: targetAvailability } : current,
      ),
    );

    try {
      await this.api.updateOptionItem(setId, item.id, {
        name: item.name,
        sortOrder: item.sortOrder,
        isActive: item.isActive,
        isAvailable: targetAvailability,
      });
    } catch {
      this.optionItems.update((items) =>
        items.map((current) =>
          current.id === item.id ? { ...current, isAvailable: previous } : current,
        ),
      );
      this.errorMessage.set('No fue posible actualizar disponibilidad del item.');
    }
  }

  cancelItemEdit() {
    this.editingItemId.set(null);
    this.itemNameControl.setValue('');
    this.itemSortOrderControl.setValue(0);
    this.itemIsActiveControl.setValue(true);
    this.itemIsAvailableControl.setValue(true);
    this.itemNameControl.markAsUntouched();
    this.itemSortOrderControl.markAsUntouched();
  }

  async onDeactivateItem(item: OptionItemDto) {
    const setId = this.selectedSetIdControl.value;
    if (!setId || !item.isActive) {
      return;
    }

    try {
      await this.api.deactivateOptionItem(setId, item.id);
      await this.loadItems();
    } catch {
      this.errorMessage.set('No fue posible desactivar el item.');
    }
  }

  private async loadSets() {
    this.errorMessage.set('');
    try {
      const sets = await this.api.getOptionSets(true);
      this.optionSets.set(sets);
      if (sets.length > 0) {
        this.selectedSetIdControl.setValue(sets[0].id);
      } else {
        this.selectedSetIdControl.setValue('');
        this.optionItems.set([]);
      }
    } catch {
      this.errorMessage.set('No fue posible cargar option sets.');
    }
  }

  private async loadItems() {
    const setId = this.selectedSetIdControl.value;
    if (!setId) {
      this.optionItems.set([]);
      return;
    }

    try {
      this.optionItems.set(await this.api.getOptionItems(setId, true));
    } catch {
      this.errorMessage.set('No fue posible cargar los items.');
    }
  }
}
