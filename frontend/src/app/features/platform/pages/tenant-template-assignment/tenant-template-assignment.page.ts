import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { PlatformCatalogTemplatesApiService } from '../../services/platform-catalog-templates-api.service';

@Component({
  selector: 'app-tenant-template-assignment-page',
  imports: [ReactiveFormsModule],
  template: `
    <div class="assignment-page">
      <!-- HEADER con barra decorativa -->
      <header class="page-header">
        <h2>🔗 Asignar template a tenant</h2>
        <p class="page-subtitle">Selecciona un tenant y un template de catálogo para asignarlo</p>
        <div class="header-decoration"></div>
      </header>

      <!-- TARJETA DE ASIGNACIÓN -->
      <div class="section-card">
        <div class="section-header">
          <span class="section-icon">📋</span>
          <h3>Asignación</h3>
        </div>

        <form class="assignment-form">
          <div class="form-grid">
            <!-- Tenant ID -->
            <div class="form-field">
              <label for="tenant-select">Tenant ID</label>
              <input
                id="tenant-select"
                type="text"
                [formControl]="tenantIdControl"
                placeholder="Ej: tenant-123"
                class="form-input"
                data-testid="platform-assign-tenant"
              />
              @if (tenantIdControl.invalid && tenantIdControl.touched) {
                <div class="field-error">El tenant ID es obligatorio</div>
              }
            </div>

            <!-- Template -->
            <div class="form-field">
              <label for="template-select">Template</label>
              <div class="select-wrapper">
                <select
                  id="template-select"
                  [formControl]="templateIdControl"
                  class="form-select"
                  data-testid="platform-assign-template"
                >
                  <option value="" disabled>Selecciona template</option>
                  @for (template of templates(); track template.id) {
                    <option [value]="template.id">{{ template.name }} ({{ template.verticalId }})</option>
                  }
                </select>
              </div>
              @if (templateIdControl.invalid && templateIdControl.touched) {
                <div class="field-error">Debes seleccionar un template</div>
              }
            </div>

            <!-- Botón de acción -->
            <div class="form-actions">
              <button
                type="button"
                class="btn-primary"
                (click)="assign()"
                [disabled]="tenantIdControl.invalid || templateIdControl.invalid"
                data-testid="platform-assign-submit"
              >
                ✅ Asignar
              </button>
            </div>
          </div>
        </form>

        <!-- Mensaje de resultado -->
        @if (message()) {
          <div
            class="message"
            [class.success]="isSuccessMessage()"
            [class.error]="isErrorMessage()"
            role="status"
          >
            <span class="message-icon">{{ isSuccessMessage() ? '✅' : '⚠️' }}</span>
            <span>{{ message() }}</span>
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

    .assignment-page {
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

    /* ===== FORMULARIO ===== */
    .assignment-form {
      width: 100%;
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr auto;
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

    /* Select personalizado */
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
    }

    /* ===== BOTÓN PRIMARIO ===== */
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

    /* ===== MENSAJE DE RESULTADO ===== */
    .message {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: var(--radius-md);
      font-weight: 500;
      animation: slide-down 200ms ease-out;
    }

    .message.success {
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.2);
      color: #065f46;
    }

    .message.error {
      background: rgba(180, 35, 24, 0.08);
      border: 1px solid rgba(180, 35, 24, 0.2);
      color: #b42318;
    }

    .message-icon {
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

    /* ===== RESPONSIVE ===== */
    @media (max-width: 900px) {
      .form-grid {
        grid-template-columns: 1fr;
      }

      .form-actions {
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
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantTemplateAssignmentPage {
  private readonly api = inject(PlatformCatalogTemplatesApiService);

  readonly templates = signal<Array<{ id: string; name: string; verticalId: string }>>([]);
  readonly message = signal('');

  readonly tenantIdControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly templateIdControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });

  readonly isSuccessMessage = computed(() => {
    const msg = this.message();
    return msg && !msg.includes('No fue posible') && !msg.includes('error');
  });

  readonly isErrorMessage = computed(() => {
    const msg = this.message();
    return msg && (msg.includes('No fue posible') || msg.includes('error'));
  });

  constructor() {
    void this.load();
  }

  private async load() {
    this.templates.set(await this.api.listTemplates());
  }

  async assign() {
    this.message.set('');
    if (this.tenantIdControl.invalid || this.templateIdControl.invalid) {
      this.tenantIdControl.markAsTouched();
      this.templateIdControl.markAsTouched();
      return;
    }

    try {
      await this.api.assignTemplateToTenant(this.tenantIdControl.value, {
        catalogTemplateId: this.templateIdControl.value,
      });
      this.message.set('Template asignado correctamente.');
    } catch {
      this.message.set('No fue posible asignar template. Intenta nuevamente.');
    }
  }
}