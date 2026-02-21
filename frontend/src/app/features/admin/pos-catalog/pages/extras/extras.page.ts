import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ExtraDto } from '../../models/pos-catalog.models';
import { PosCatalogApiService } from '../../services/pos-catalog-api.service';
import { PosAdminCatalogOverridesApiService } from '../../services/pos-admin-catalog-overrides-api.service';
import { PosAdminCatalogAvailabilityApiService } from '../../services/pos-admin-catalog-availability-api.service';
import { StoreContextService } from '../../../../pos/services/store-context.service';

@Component({
  selector: 'app-pos-catalog-extras-page',
  imports: [ReactiveFormsModule],
  template: `
    <div class="extras-page">
      <!-- HEADER con barra decorativa -->
      <header class="page-header">
        <h2>&#127831; Extras</h2>
        <p class="page-subtitle">Administra productos adicionales con costo extra</p>
        <div class="header-decoration"></div>
      </header>

      <!-- TARJETA DE FORMULARIO -->
      <div class="section-card">
        <div class="section-header">
          <span class="section-icon">&#128722;</span>
          <h3>{{ editingId() ? 'Editar extra' : 'Crear nuevo extra' }}</h3>
          @if (extras().length > 0 && !editingId()) {
            <span class="count-badge">
              {{ extras().length }} {{ extras().length === 1 ? 'extra' : 'extras' }}
            </span>
          }
        </div>

        <form class="form-layout" (submit)="onSubmit($event)">
          <div class="form-grid">
            <div class="form-field">
              <label for="extra-name">Nombre del extra</label>
              <input
                id="extra-name"
                type="text"
                [formControl]="nameControl"
                placeholder="Ej: Queso extra, Tocino, Aguacate"
                class="form-input"
              />
              @if (nameControl.invalid && nameControl.touched) {
                <div class="field-error">El nombre es obligatorio</div>
              }
            </div>

            <div class="form-field">
              <label for="extra-price">Precio adicional ($)</label>
              <input
                id="extra-price"
                type="number"
                min="0"
                step="0.01"
                [formControl]="priceControl"
                placeholder="0.00"
                class="form-input"
              />
              @if (priceControl.invalid && priceControl.touched) {
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

            <div class="form-actions full-width">
              @if (editingId()) {
                <button
                  type="button"
                  class="btn-outline"
                  (click)="resetForm()"
                >
                  Cancelar
                </button>
              }
              <button
                type="submit"
                class="btn-primary"
                [disabled]="
                  nameControl.invalid ||
                  priceControl.invalid
                "
              >
                <span>{{ editingId() ? '&#128190;' : '&#10024;' }}</span>
                {{ editingId() ? 'Guardar cambios' : 'Crear extra' }}
              </button>
            </div>
          </div>
        </form>
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

      <!-- LISTA DE EXTRAS -->
      @if (extras().length === 0) {
        <div class="empty-state">
          <span class="empty-icon">&#127831;</span>
          <p>No hay extras creados</p>
          <p class="empty-hint">Crea un extra para comenzar</p>
        </div>
      } @else {
        <div class="extras-header">
          <span class="extras-count">
            {{ extras().length }} {{ extras().length === 1 ? 'extra disponible' : 'extras disponibles' }}
          </span>
        </div>

        <ul class="extras-grid" aria-label="Listado de extras">
          @for (item of extras(); track item.id) {
            <li class="extra-card">
              <div class="extra-info">
                <span class="extra-icon">&#127831;</span>
                <div class="extra-details">
                  <span class="extra-name">{{ item.name }}</span>
                  <div class="extra-meta">
                    <span class="extra-price">$ {{ item.price.toFixed(2) }}</span>
                    <span
                      class="status-badge"
                      [class.status-badge--active]="item.isActive"
                      [class.status-badge--inactive]="!item.isActive"
                    >
                      {{ item.isActive ? '&#9989; Activo' : '&#9940; Inactivo' }}
                    </span>
                    <label>
                      <input type="checkbox" [checked]="isEnabled(item.id)" (change)="onToggleOverride(item.id, $event)" [attr.data-testid]="'override-toggle-Extra-' + item.id" />
                      Ofrecer
                    </label>
                    <label>
                      <input type="checkbox" [checked]="item.isAvailable" [disabled]="!isEnabled(item.id)" (change)="onToggleAvailability(item, $event)" [attr.data-testid]="'availability-toggle-Extra-' + item.id" />
                      Disponible en sucursal
                    </label>
                  </div>
                </div>
              </div>
              <div class="extra-actions">
                <button
                  type="button"
                  class="btn-outline btn-small"
                  (click)="onEdit(item)"
                >
                  &#9998; Editar
                </button>
                <button
                  type="button"
                  class="btn-outline btn-danger btn-small"
                  (click)="onDeactivate(item)"
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

    .extras-page {
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

    /* ===== TARJETA DE SECCIÓN ===== */
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

    /* ===== FORMULARIO ===== */
    .form-layout {
      width: 100%;
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr auto auto;
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
      align-items: center;
      flex-shrink: 0;
    }

    .form-actions.full-width {
      grid-column: -1 / 1;
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
    .extras-header {
      display: flex;
      justify-content: flex-end;
      margin-top: 0.5rem;
    }

    .extras-count {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--brand-muted);
      background: rgba(243, 182, 194, 0.2);
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
    }

    /* ===== GRID DE EXTRAS ===== */
    .extras-grid {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }

    .extra-card {
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

    .extra-card:hover {
      border-color: var(--brand-rose-strong);
      box-shadow: var(--shadow-hover);
      transform: translateY(-2px);
    }

    .extra-info {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
      margin-bottom: 1rem;
    }

    .extra-icon {
      font-size: 1.8rem;
      color: var(--brand-cocoa);
      opacity: 0.8;
    }

    .extra-details {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      flex: 1;
    }

    .extra-name {
      font-weight: 700;
      font-size: 1.1rem;
      color: var(--brand-ink);
      word-break: break-word;
    }

    .extra-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .extra-price {
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

    .extra-actions {
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

      .form-actions.full-width {
        grid-column: span 2;
      }
    }

    @media (max-width: 600px) {
      .section-card {
        padding: 1.25rem;
      }

      .form-grid {
        grid-template-columns: 1fr;
      }

      .form-actions.full-width {
        grid-column: span 1;
        justify-content: stretch;
      }

      .btn-primary {
        width: 100%;
      }

      .extras-grid {
        grid-template-columns: 1fr;
      }

      .extra-card {
        padding: 1rem;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExtrasPage {
  private readonly api = inject(PosCatalogApiService);
  private readonly overridesApi = inject(PosAdminCatalogOverridesApiService);
  private readonly availabilityApi = inject(PosAdminCatalogAvailabilityApiService);
  private readonly storeContext = inject(StoreContextService);

  readonly extras = signal<ExtraDto[]>([]);
  readonly errorMessage = signal('');
  readonly editingId = signal<string | null>(null);
  readonly overrideByItemId = signal<Record<string, boolean>>({});

  readonly nameControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  readonly priceControl = new FormControl(0, {
    nonNullable: true,
    validators: [Validators.required, Validators.min(0)],
  });

  readonly isActiveControl = new FormControl(true, { nonNullable: true });
  readonly isAvailableControl = new FormControl(true, { nonNullable: true });

  constructor() {
    void this.load();
  }

  async onSubmit(event: Event) {
    event.preventDefault();

    if (this.nameControl.invalid || this.priceControl.invalid) {
      this.nameControl.markAsTouched();
      this.priceControl.markAsTouched();
      return;
    }

    try {
      const payload = {
        name: this.nameControl.value.trim(),
        price: this.priceControl.value,
        isActive: this.isActiveControl.value,
        isAvailable: this.isAvailableControl.value,
      };
      const id = this.editingId();
      if (id) {
        await this.api.updateExtra(id, payload);
      } else {
        await this.api.createExtra(payload);
      }
      this.resetForm();
      await this.load();
    } catch {
      this.errorMessage.set('No fue posible guardar el extra.');
    }
  }

  onEdit(item: ExtraDto) {
    this.editingId.set(item.id);
    this.nameControl.setValue(item.name);
    this.priceControl.setValue(item.price);
    this.isActiveControl.setValue(item.isActive);
    this.isAvailableControl.setValue(item.isAvailable);
  }

  isEnabled(itemId: string) {
    return this.overrideByItemId()[itemId] ?? true;
  }

  async onToggleOverride(itemId: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    await this.overridesApi.upsertOverride({ itemType: 'Extra', itemId, isEnabled: checked });
    this.overrideByItemId.update((current) => ({ ...current, [itemId]: checked }));
  }

  async onToggleAvailability(item: ExtraDto, event: Event) {
    const storeId = this.storeContext.getActiveStoreId();
    if (!storeId) {
      return;
    }

    const checked = (event.target as HTMLInputElement).checked;
    await this.availabilityApi.upsertAvailability({ storeId, itemType: 'Extra', itemId: item.id, isAvailable: checked });
    this.extras.update((items) => items.map((current) => current.id === item.id ? { ...current, isAvailable: checked } : current));
  }

  async onDeactivate(item: ExtraDto) {
    if (!item.isActive) return;

    try {
      await this.api.deactivateExtra(item.id);
      await this.load();
    } catch {
      this.errorMessage.set('No fue posible desactivar el extra.');
    }
  }

  resetForm() {
    this.editingId.set(null);
    this.nameControl.setValue('');
    this.priceControl.setValue(0);
    this.isActiveControl.setValue(true);
    this.isAvailableControl.setValue(true);
    this.nameControl.markAsUntouched();
    this.priceControl.markAsUntouched();
  }

  private async load() {
    this.errorMessage.set('');
    try {
      this.extras.set(await this.api.getExtras(true));
    } catch {
      this.errorMessage.set('No fue posible cargar extras.');
    }
  }
}
