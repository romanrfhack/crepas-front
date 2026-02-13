import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { OptionSetDto, SchemaDto, SelectionGroupDto } from '../../models/pos-catalog.models';
import { PosCatalogApiService } from '../../services/pos-catalog-api.service';

@Component({
  selector: 'app-pos-catalog-schemas-page',
  imports: [ReactiveFormsModule],
  template: `
    <div class="schemas-page">
      <!-- HEADER con barra decorativa -->
      <header class="page-header">
        <h2>&#128295; Schemas y grupos</h2>
        <p class="page-subtitle">Administra esquemas de personalización y sus grupos de selección</p>
        <div class="header-decoration"></div>
      </header>

      <!-- SECCIÓN: ADMINISTRAR SCHEMAS -->
      <div class="section-card">
        <div class="section-header">
          <span class="section-icon">&#128193;</span>
          <h3>Schemas</h3>
          @if (schemas().length > 0) {
            <span class="count-badge">
              {{ schemas().length }} {{ schemas().length === 1 ? 'schema' : 'schemas' }}
            </span>
          }
        </div>

        <!-- Formulario para crear Schema -->
        <form class="inline-form" (submit)="onSubmitSchema($event)">
          <div class="inline-form-fields">
            <div class="form-field">
              <label for="schema-name">Nombre del schema</label>
              <input
                id="schema-name"
                type="text"
                [formControl]="schemaNameControl"
                placeholder="Ej: Café, Hamburguesa"
                class="form-input"
              />
              @if (schemaNameControl.invalid && schemaNameControl.touched) {
                <div class="field-error">El nombre es obligatorio</div>
              }
            </div>
            <div class="form-field checkbox-field">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  [formControl]="schemaIsActiveControl"
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
              [disabled]="schemaNameControl.invalid"
            >
              &#10024; Crear schema
            </button>
          </div>
        </form>

        <!-- Selector de Schema -->
        @if (schemas().length > 0) {
          <div class="selector-field">
            <label for="schema-selector">Schema seleccionado</label>
            <div class="select-wrapper">
              <select
                id="schema-selector"
                [formControl]="selectedSchemaIdControl"
                class="form-select"
              >
                @for (item of schemas(); track item.id) {
                  <option [value]="item.id">{{ item.name }}</option>
                }
              </select>
            </div>
          </div>
        } @else {
          <div class="empty-state small">
            <span class="empty-icon">&#128295;</span>
            <p>No hay schemas creados</p>
            <p class="empty-hint">Crea un schema para comenzar</p>
          </div>
        }
      </div>

      <!-- SECCIÓN: ADMINISTRAR GRUPOS (solo si hay schema seleccionado) -->
      @if (selectedSchemaIdControl.value && schemas().length > 0) {
        <div class="section-card">
          <div class="section-header">
            <span class="section-icon">&#128722;</span>
            <h3>Grupos de: {{ getSelectedSchemaName() }}</h3>
            @if (groups().length > 0) {
              <span class="count-badge">
                {{ groups().length }} {{ groups().length === 1 ? 'grupo' : 'grupos' }}
              </span>
            }
          </div>

          <!-- Formulario para crear/editar Grupo -->
          <form class="groups-form" (submit)="onSubmitGroup($event)">
            <div class="form-grid">
              <div class="form-field">
                <label for="group-key">Key (identificador)</label>
                <input
                  id="group-key"
                  type="text"
                  [formControl]="groupKeyControl"
                  placeholder="Ej: size, milk"
                  class="form-input"
                />
                @if (groupKeyControl.invalid && groupKeyControl.touched) {
                  <div class="field-error">La key es obligatoria</div>
                }
              </div>

              <div class="form-field">
                <label for="group-label">Label (etiqueta)</label>
                <input
                  id="group-label"
                  type="text"
                  [formControl]="groupLabelControl"
                  placeholder="Ej: Tamaño, Tipo de leche"
                  class="form-input"
                />
                @if (groupLabelControl.invalid && groupLabelControl.touched) {
                  <div class="field-error">El label es obligatorio</div>
                }
              </div>

              <div class="form-field">
                <label for="group-mode">Modo</label>
                <select
                  id="group-mode"
                  [formControl]="groupSelectionModeControl"
                  class="form-select"
                >
                  <option [value]="0">Single (radio)</option>
                  <option [value]="1">Multi (checkbox)</option>
                </select>
              </div>

              <div class="form-field">
                <label for="group-min">Mínimo</label>
                <input
                  id="group-min"
                  type="number"
                  min="0"
                  [formControl]="groupMinControl"
                  placeholder="0"
                  class="form-input"
                />
                @if (groupMinControl.invalid && groupMinControl.touched) {
                  <div class="field-error">Mínimo 0</div>
                }
              </div>

              <div class="form-field">
                <label for="group-max">Máximo</label>
                <input
                  id="group-max"
                  type="number"
                  min="1"
                  [formControl]="groupMaxControl"
                  placeholder="1"
                  class="form-input"
                />
                @if (groupMaxControl.invalid && groupMaxControl.touched) {
                  <div class="field-error">Máximo mínimo 1</div>
                }
              </div>

              <div class="form-field">
                <label for="group-optionset">Option set</label>
                <div class="select-wrapper">
                  <select
                    id="group-optionset"
                    [formControl]="groupOptionSetIdControl"
                    class="form-select"
                  >
                    @for (set of optionSets(); track set.id) {
                      <option [value]="set.id">{{ set.name }}</option>
                    }
                  </select>
                </div>
                @if (groupOptionSetIdControl.invalid && groupOptionSetIdControl.touched) {
                  <div class="field-error">Selecciona un option set</div>
                }
              </div>

              <div class="form-field checkbox-field">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    [formControl]="groupIsActiveControl"
                    class="checkbox-input"
                  />
                  <span class="checkbox-text">Activo</span>
                </label>
              </div>

              <div class="form-actions full-width">
                @if (editingGroupId()) {
                  <button
                    type="button"
                    class="btn-outline"
                    (click)="cancelGroupEdit()"
                  >
                    Cancelar
                  </button>
                }
                <button
                  type="submit"
                  class="btn-primary"
                  [disabled]="
                    groupKeyControl.invalid ||
                    groupLabelControl.invalid ||
                    groupMinControl.invalid ||
                    groupMaxControl.invalid ||
                    groupOptionSetIdControl.invalid
                  "
                >
                  <span>{{ editingGroupId() ? '&#128190;' : '&#10024;' }}</span>
                  {{ editingGroupId() ? 'Guardar grupo' : 'Crear grupo' }}
                </button>
              </div>
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

          <!-- LISTA DE GRUPOS -->
          @if (groups().length === 0) {
            <div class="empty-state">
              <span class="empty-icon">&#128230;</span>
              <p>No hay grupos en este schema</p>
              <p class="empty-hint">Crea un grupo para comenzar</p>
            </div>
          } @else {
            <ul class="groups-grid" aria-label="Listado de grupos">
              @for (group of groups(); track group.id) {
                <li class="group-card">
                  <div class="group-info">
                    <span class="group-icon">&#128279;</span>
                    <div class="group-details">
                      <div class="group-header-line">
                        <span class="group-key">{{ group.key }}</span>
                        <span class="group-label">{{ group.label }}</span>
                      </div>
                      <div class="group-meta">
                        <span class="group-mode">
                          {{ group.selectionMode === 0 ? '🔘 Single' : '✅ Multi' }}
                        </span>
                        <span class="group-range">
                          {{ group.minSelections }} – {{ group.maxSelections }}
                        </span>
                        <span
                          class="status-badge"
                          [class.status-badge--active]="group.isActive"
                          [class.status-badge--inactive]="!group.isActive"
                        >
                          {{ group.isActive ? '&#9989; Activo' : '&#9940; Inactivo' }}
                        </span>
                      </div>
                      <div class="group-option-set">
                        <span class="meta-label">Option set:</span>
                        {{ getOptionSetName(group.optionSetId) }}
                      </div>
                    </div>
                  </div>
                  <div class="group-actions">
                    <button
                      type="button"
                      class="btn-outline btn-small"
                      (click)="onEditGroup(group)"
                    >
                      &#9998; Editar
                    </button>
                    <button
                      type="button"
                      class="btn-outline btn-danger btn-small"
                      (click)="onDeactivateGroup(group)"
                      [disabled]="!group.isActive"
                    >
                      &#128465; Desactivar
                    </button>
                  </div>
                </li>
              }
            </ul>
          }
        </div>
      } @else if (schemas().length > 0) {
        <!-- Mensaje cuando no hay schema seleccionado (caso borde) -->
        <div class="empty-state">
          <span class="empty-icon">&#128295;</span>
          <p>Selecciona un schema para administrar sus grupos</p>
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

    .schemas-page {
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

    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      align-items: flex-end;
      width: 100%;
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

    .form-actions.full-width {
      grid-column: 1 / -1;
      justify-content: flex-end;
    }

    /* ===== SELECTOR ===== */
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

    /* ===== GRID DE GRUPOS ===== */
    .groups-grid {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1rem;
    }

    .group-card {
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

    .group-card:hover {
      border-color: var(--brand-rose-strong);
      box-shadow: var(--shadow-hover);
      transform: translateY(-2px);
    }

    .group-info {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
      margin-bottom: 1rem;
    }

    .group-icon {
      font-size: 1.5rem;
      color: var(--brand-cocoa);
      opacity: 0.8;
    }

    .group-details {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      flex: 1;
    }

    .group-header-line {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .group-key {
      font-weight: 700;
      font-size: 1.1rem;
      color: var(--brand-ink);
      word-break: break-word;
    }

    .group-label {
      font-weight: 500;
      font-size: 0.95rem;
      color: var(--brand-muted);
    }

    .group-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .group-mode,
    .group-range {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--brand-muted);
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

    .group-option-set {
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

    .group-actions {
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

      .form-grid {
        grid-template-columns: 1fr;
      }

      .form-actions.full-width {
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

      .groups-grid {
        grid-template-columns: 1fr;
      }

      .group-card {
        padding: 1rem;
      }

      .group-header-line {
        flex-direction: column;
        gap: 0.15rem;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchemasPage {
  private readonly api = inject(PosCatalogApiService);

  readonly schemas = signal<SchemaDto[]>([]);
  readonly optionSets = signal<OptionSetDto[]>([]);
  readonly groups = signal<SelectionGroupDto[]>([]);
  readonly errorMessage = signal('');
  readonly editingGroupId = signal<string | null>(null);

  readonly schemaNameControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  readonly schemaIsActiveControl = new FormControl(true, { nonNullable: true });
  readonly selectedSchemaIdControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  readonly groupKeyControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  readonly groupLabelControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  readonly groupSelectionModeControl = new FormControl(0, { nonNullable: true });
  readonly groupMinControl = new FormControl(0, {
    nonNullable: true,
    validators: [Validators.min(0)],
  });
  readonly groupMaxControl = new FormControl(1, {
    nonNullable: true,
    validators: [Validators.min(1)],
  });
  readonly groupOptionSetIdControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  readonly groupIsActiveControl = new FormControl(true, { nonNullable: true });

  constructor() {
    this.selectedSchemaIdControl.valueChanges.subscribe(() => {
      void this.loadGroups();
    });
    void this.bootstrap();
  }

  /** Obtiene el nombre del schema seleccionado */
  getSelectedSchemaName(): string {
    const schemaId = this.selectedSchemaIdControl.value;
    const schema = this.schemas().find(s => s.id === schemaId);
    return schema?.name ?? '';
  }

  /** Obtiene el nombre de un option set por su ID */
  getOptionSetName(optionSetId: string): string {
    const set = this.optionSets().find(s => s.id === optionSetId);
    return set?.name ?? '—';
  }

  async onSubmitSchema(event: Event) {
    event.preventDefault();
    if (this.schemaNameControl.invalid) {
      this.schemaNameControl.markAsTouched();
      return;
    }

    try {
      await this.api.createSchema({
        name: this.schemaNameControl.value.trim(),
        isActive: this.schemaIsActiveControl.value,
      });
      this.schemaNameControl.setValue('');
      this.schemaIsActiveControl.setValue(true);
      this.schemaNameControl.markAsUntouched();
      await this.loadSchemas();
    } catch {
      this.errorMessage.set('No fue posible guardar el schema.');
    }
  }

  async onSubmitGroup(event: Event) {
    event.preventDefault();
    const schemaId = this.selectedSchemaIdControl.value;
    if (
      !schemaId ||
      this.groupKeyControl.invalid ||
      this.groupLabelControl.invalid ||
      this.groupOptionSetIdControl.invalid ||
      this.groupMinControl.invalid ||
      this.groupMaxControl.invalid
    ) {
      this.groupKeyControl.markAsTouched();
      this.groupLabelControl.markAsTouched();
      this.groupOptionSetIdControl.markAsTouched();
      this.groupMinControl.markAsTouched();
      this.groupMaxControl.markAsTouched();
      return;
    }

    try {
      const payload = {
        key: this.groupKeyControl.value.trim(),
        label: this.groupLabelControl.value.trim(),
        selectionMode: Number(this.groupSelectionModeControl.value),
        minSelections: this.groupMinControl.value,
        maxSelections: this.groupMaxControl.value,
        optionSetId: this.groupOptionSetIdControl.value,
        isActive: this.groupIsActiveControl.value,
        sortOrder: 0,
      };
      const groupId = this.editingGroupId();
      if (groupId) {
        await this.api.updateGroup(schemaId, groupId, payload);
      } else {
        await this.api.createGroup(schemaId, payload);
      }
      this.cancelGroupEdit();
      await this.loadGroups();
    } catch {
      this.errorMessage.set('No fue posible guardar el grupo.');
    }
  }

  onEditGroup(group: SelectionGroupDto) {
    this.editingGroupId.set(group.id);
    this.groupKeyControl.setValue(group.key);
    this.groupLabelControl.setValue(group.label);
    this.groupSelectionModeControl.setValue(group.selectionMode);
    this.groupMinControl.setValue(group.minSelections);
    this.groupMaxControl.setValue(group.maxSelections);
    this.groupOptionSetIdControl.setValue(group.optionSetId);
    this.groupIsActiveControl.setValue(group.isActive);
  }

  cancelGroupEdit() {
    this.editingGroupId.set(null);
    this.groupKeyControl.setValue('');
    this.groupLabelControl.setValue('');
    this.groupSelectionModeControl.setValue(0);
    this.groupMinControl.setValue(0);
    this.groupMaxControl.setValue(1);
    this.groupIsActiveControl.setValue(true);
    this.groupKeyControl.markAsUntouched();
    this.groupLabelControl.markAsUntouched();
    this.groupMinControl.markAsUntouched();
    this.groupMaxControl.markAsUntouched();
    this.groupOptionSetIdControl.markAsUntouched();

    // Restaurar primer option set si existe
    if (this.optionSets().length > 0) {
      this.groupOptionSetIdControl.setValue(this.optionSets()[0].id);
    } else {
      this.groupOptionSetIdControl.setValue('');
    }
  }

  async onDeactivateGroup(group: SelectionGroupDto) {
    const schemaId = this.selectedSchemaIdControl.value;
    if (!schemaId || !group.isActive) {
      return;
    }

    try {
      await this.api.deactivateGroup(schemaId, group.id);
      await this.loadGroups();
    } catch {
      this.errorMessage.set('No fue posible desactivar el grupo.');
    }
  }

  private async bootstrap() {
    try {
      await this.loadOptionSets();
      await this.loadSchemas();
    } catch {
      this.errorMessage.set('No fue posible cargar los datos iniciales.');
    }
  }

  private async loadSchemas() {
    try {
      const schemas = await this.api.getSchemas(true);
      this.schemas.set(schemas);
      if (schemas.length > 0) {
        this.selectedSchemaIdControl.setValue(schemas[0].id);
      } else {
        this.selectedSchemaIdControl.setValue('');
        this.groups.set([]);
      }
    } catch {
      this.errorMessage.set('No fue posible cargar los schemas.');
    }
  }

  private async loadOptionSets() {
    try {
      const sets = await this.api.getOptionSets(true);
      this.optionSets.set(sets);
      if (sets.length > 0) {
        this.groupOptionSetIdControl.setValue(sets[0].id);
      } else {
        this.groupOptionSetIdControl.setValue('');
      }
    } catch {
      this.errorMessage.set('No fue posible cargar los option sets.');
    }
  }

  private async loadGroups() {
    const schemaId = this.selectedSchemaIdControl.value;
    if (!schemaId) {
      this.groups.set([]);
      return;
    }

    try {
      this.groups.set(await this.api.getGroups(schemaId, true));
    } catch {
      this.errorMessage.set('No fue posible cargar los grupos.');
    }
  }
}