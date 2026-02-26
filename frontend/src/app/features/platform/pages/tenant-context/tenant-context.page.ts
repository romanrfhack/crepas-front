import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { PlatformTenantContextService } from '../../services/platform-tenant-context.service';

@Component({
  selector: 'app-tenant-context-page',
  imports: [ReactiveFormsModule],
  template: `
    <div class="tenant-context-page">
      <!-- HEADER con barra decorativa -->
      <header class="page-header">
        <h2>🏢 Contexto de tenant</h2>
        <p class="page-subtitle">Configura el tenant activo para operaciones de superadministrador</p>
        <div class="header-decoration"></div>
      </header>

      <!-- TARJETA PRINCIPAL -->
      <div class="section-card">
        <div class="section-header">
          <span class="section-icon">⚙️</span>
          <h3>Seleccionar tenant</h3>
        </div>

        <div class="form-container">
          <div class="form-field">
            <label for="tenant-context-id">Tenant ID</label>
            <input
              id="tenant-context-id"
              [formControl]="tenantIdControl"
              placeholder="Ej: tenant-123, acme-corp"
              class="form-input"
              data-testid="platform-tenant-context-select"
            />
            @if (tenantIdControl.invalid && tenantIdControl.touched) {
              <div class="field-error">El Tenant ID es obligatorio</div>
            }
          </div>

          <div class="info-hint">
            <span class="hint-icon">ℹ️</span>
            <span>Contexto actual: <strong>{{ currentTenant() || 'Ninguno' }}</strong></span>
          </div>

          <div class="form-actions">
            <button
              type="button"
              class="btn-primary"
              (click)="save()"
              [disabled]="tenantIdControl.invalid"
            >
              💾 Guardar contexto
            </button>
          </div>

          @if (successMessage()) {
            <div class="success-message" role="status">
              <span class="success-icon">✅</span>
              <span>{{ successMessage() }}</span>
            </div>
          }

          @if (errorMessage()) {
            <div class="error-message" role="alert">
              <span class="error-icon">⚠️</span>
              <span>{{ errorMessage() }}</span>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      /* Variables de diseño - mismas que en otros componentes */
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
      --radius-md: 0.75rem;
      --radius-lg: 22px;
      --transition: 140ms ease;
    }

    .tenant-context-page {
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

    /* ===== TARJETA ===== */
    .section-card {
      background: white;
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 1.5rem;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      max-width: 500px;
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
    .form-container {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
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
      width: 92%;
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

    .field-error {
      font-size: 0.75rem;
      color: #b42318;
      margin-top: 0.1rem;
      padding-left: 0.5rem;
    }

    .info-hint {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
      color: var(--brand-muted);
      background: rgba(243, 182, 194, 0.12);
      border-radius: 999px;
      padding: 0.5rem 1rem;
    }

    .hint-icon {
      font-size: 1rem;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
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

    /* ===== MENSAJES DE ÉXITO Y ERROR ===== */
    .success-message {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.2);
      border-radius: var(--radius-md);
      color: #065f46;
      font-weight: 500;
      animation: slide-down 200ms ease-out;
    }

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

    .success-icon, .error-icon {
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
    @media (max-width: 600px) {
      .section-card {
        padding: 1.25rem;
        max-width: 100%;
      }

      .form-actions {
        justify-content: stretch;
      }

      .btn-primary {
        width: 100%;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantContextPage {
  private readonly tenantContext = inject(PlatformTenantContextService);

  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly currentTenant = signal<string | null>(this.tenantContext.getSelectedTenantId());

  readonly tenantIdControl = new FormControl(this.currentTenant() ?? '', {
    nonNullable: true,
    validators: [Validators.required],
  });

  save() {
    if (this.tenantIdControl.invalid) {
      this.tenantIdControl.markAsTouched();
      return;
    }

    const newTenantId = this.tenantIdControl.value || null;
    try {
      this.tenantContext.setSelectedTenantId(newTenantId);
      this.currentTenant.set(newTenantId);
      this.successMessage.set('Contexto de tenant guardado correctamente.');
      this.errorMessage.set(null);

      // Opcional: limpiar el mensaje después de unos segundos
      setTimeout(() => {
        this.successMessage.set(null);
      }, 3000);
    } catch {
      this.errorMessage.set('No se pudo guardar el contexto. Intenta nuevamente.');
      this.successMessage.set(null);
    }
  }
}