import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormField, email, form, minLength, required } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../services/auth.service';

interface RegisterModel {
  email: string;
  password: string;
}

@Component({
  selector: 'app-register',
  imports: [FormField, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <!-- Header con barra decorativa -->
        <header class="auth-header">
          <h1 id="register-title">&#128270; Crear cuenta</h1>
          <p class="auth-subtitle">Completa tus datos para registrarte</p>
          <div class="header-decoration"></div>
        </header>

        <!-- Formulario -->
        <form (submit)="onSubmit($event)" class="auth-form" novalidate>
          <!-- Campo email -->
          <div class="form-field">
            <label for="register-email">Correo electrónico</label>
            <input
              id="register-email"
              type="email"
              [formField]="fieldTree.email"
              autocomplete="email"
              [attr.aria-invalid]="emailInvalid()"
              aria-required="true"
              placeholder="ejemplo@correo.com"
              class="form-input"
            />
            @if (emailInvalid()) {
              <div class="field-error" role="alert">
                <span class="error-icon">&#9888;</span>
                <span>{{ emailErrorMessage() }}</span>
              </div>
            }
          </div>

          <!-- Campo contraseña -->
          <div class="form-field">
            <label for="register-password">Contraseña</label>
            <input
              id="register-password"
              type="password"
              [formField]="fieldTree.password"
              autocomplete="new-password"
              [attr.aria-invalid]="passwordInvalid()"
              aria-required="true"
              placeholder="Mínimo 6 caracteres"
              class="form-input"
            />
            @if (passwordInvalid()) {
              <div class="field-error" role="alert">
                <span class="error-icon">&#9888;</span>
                <span>{{ passwordErrorMessage() }}</span>
              </div>
            }
          </div>

          <!-- Mensaje de error general -->
          @if (errorMessage()) {
            <div class="error-message" role="alert">
              <span class="error-icon">&#9888;</span>
              <span>{{ errorMessage() }}</span>
            </div>
          }

          <!-- Botón de registro -->
          <button type="submit" [disabled]="submitDisabled()" class="btn-primary">
            @if (isSubmitting()) {
              <span class="spinner"></span>
              <span>Registrando...</span>
            } @else {
              <span>✨ Crear cuenta</span>
            }
          </button>
        </form>

        <!-- Footer con enlace a login -->
        <footer class="auth-footer">
          <span>¿Ya tienes cuenta?</span>
          <a routerLink="/login" class="auth-link">Iniciar sesión</a>
        </footer>
      </div>
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
      --radius-md: 0.75rem;
      --radius-lg: 22px;
      --transition: 140ms ease;
    }

    .auth-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      background: linear-gradient(145deg, #f9fbfd 0%, #f1f5f9 100%);
    }

    .auth-card {
      width: min(420px, 100%);
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      padding: 2rem;
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
    }

    /* Header */
    .auth-header {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .auth-header h1 {
      margin: 0;
      font-size: 1.75rem;
      font-weight: 800;
      color: var(--brand-cocoa);
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .auth-subtitle {
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
      margin-top: 0.5rem;
    }

    /* Formulario */
    .auth-form {
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
      font-size: 0.9rem;
      color: var(--brand-ink);
    }

    .form-input {
      width: 100%;
      padding: 0.7rem 1rem;
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

    /* Errores de campo */
    .field-error {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.8rem;
      color: #b42318;
      background: rgba(180, 35, 24, 0.08);
      border: 1px solid rgba(180, 35, 24, 0.2);
      border-radius: 999px;
      padding: 0.35rem 0.9rem;
      margin-top: 0.15rem;
    }

    .error-icon {
      font-size: 0.9rem;
    }

    /* Mensaje de error general */
    .error-message {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: rgba(180, 35, 24, 0.08);
      border: 1px solid rgba(180, 35, 24, 0.2);
      border-radius: var(--radius-md);
      color: #b42318;
      font-weight: 500;
      animation: slide-down 200ms ease-out;
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

    /* Botón primario */
    .btn-primary {
      background: linear-gradient(135deg, var(--brand-rose-strong), #c98d6a);
      color: white;
      border: none;
      border-radius: 999px;
      padding: 0.8rem 1.6rem;
      font-weight: 700;
      font-size: 1rem;
      letter-spacing: 0.02em;
      box-shadow: 0 8px 20px rgba(201, 141, 106, 0.25);
      transition: transform var(--transition), filter var(--transition), box-shadow var(--transition);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      width: 100%;
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

    /* Spinner para estado de carga */
    .spinner {
      display: inline-block;
      width: 1rem;
      height: 1rem;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Footer */
    .auth-footer {
      display: flex;
      gap: 0.5rem;
      justify-content: center;
      color: var(--brand-muted);
      font-size: 0.9rem;
    }

    .auth-link {
      color: var(--brand-cocoa);
      font-weight: 700;
      text-decoration: none;
      border-bottom: 1px solid rgba(107, 63, 42, 0.25);
      padding-bottom: 1px;
      transition: border-color var(--transition), color var(--transition);
    }

    .auth-link:hover {
      color: #4f2d1f;
      border-bottom-color: rgba(232, 154, 172, 0.65);
    }

    .auth-link:focus-visible {
      outline: 3px solid var(--ring);
      outline-offset: 2px;
    }

    /* Responsive */
    @media (max-width: 480px) {
      .auth-card {
        padding: 1.5rem;
      }

      .auth-header h1 {
        font-size: 1.5rem;
      }

      .btn-primary {
        padding: 0.7rem 1.2rem;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly submitted = signal(false);
  readonly model = signal<RegisterModel>({
    email: '',
    password: '',
  });

  // Signal Forms (experimental)
  readonly fieldTree = form(this.model, (schemaPath) => {
    required(schemaPath.email, { message: 'Ingresa un correo.' });
    email(schemaPath.email, { message: 'Ingresa un correo válido.' });
    required(schemaPath.password, { message: 'Ingresa tu contraseña.' });
    minLength(schemaPath.password, 6, {
      message: 'La contraseña debe tener al menos 6 caracteres.',
    });
  });

  readonly formValid = computed(
    () => this.fieldTree.email().valid() && this.fieldTree.password().valid(),
  );
  readonly submitDisabled = computed(() => this.isSubmitting() || !this.formValid());

  private readonly clearErrorOnModelChange = effect(() => {
    this.model();
    const shouldClear = !untracked(() => this.isSubmitting());
    if (shouldClear && untracked(() => this.errorMessage())) {
      this.errorMessage.set('');
    }
  });

  readonly emailInvalid = computed(() => {
    const control = this.fieldTree.email();
    const errors = control.errors();
    return (this.submitted() || control.touched()) && !control.valid() && errors.length > 0;
  });

  readonly passwordInvalid = computed(() => {
    const control = this.fieldTree.password();
    const errors = control.errors();
    return (this.submitted() || control.touched()) && !control.valid() && errors.length > 0;
  });

  readonly emailErrorMessage = computed(() => {
    if (!this.emailInvalid()) {
      return '';
    }
    return this.fieldTree.email().errors()[0]?.message ?? 'Ingresa un correo válido.';
  });

  readonly passwordErrorMessage = computed(() => {
    if (!this.passwordInvalid()) {
      return '';
    }
    return (
      this.fieldTree.password().errors()[0]?.message ??
      'La contraseña debe tener al menos 6 caracteres.'
    );
  });

  onSubmit(event: Event) {
    event.preventDefault();
    this.submitted.set(true);
    if (!this.formValid()) {
      return;
    }

    this.errorMessage.set('');
    this.isSubmitting.set(true);
    const payload = this.model();
    this.authService
      .register(payload)
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => {
          void this.router.navigateByUrl('/app/dashboard');
        },
        error: () => {
          this.errorMessage.set('No pudimos completar el registro. Intenta nuevamente.');
        },
      });
  }
}