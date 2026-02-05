import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
    <main class="auth-container">
      <section class="auth-card" aria-labelledby="register-title">
        <header class="auth-header">
          <h1 id="register-title">Crear cuenta</h1>
          <p>Completa los datos para registrarte.</p>
        </header>

        <form (submit)="onSubmit($event)" class="auth-form">
          <div class="field">
            <label for="register-email">Correo</label>
            <input
              id="register-email"
              type="email"
              [formField]="fieldTree.email"
              autocomplete="email"
              [attr.aria-invalid]="emailInvalid()"
              required
            />
            @if (emailInvalid()) {
              <p class="field-error" role="alert">{{ emailErrorMessage() }}</p>
            }
          </div>

          <div class="field">
            <label for="register-password">Contraseña</label>
            <input
              id="register-password"
              type="password"
              [formField]="fieldTree.password"
              autocomplete="new-password"
              minlength="6"
              [attr.aria-invalid]="passwordInvalid()"
              required
            />
            @if (passwordInvalid()) {
              <p class="field-error" role="alert">
                {{ passwordErrorMessage() }}
              </p>
            }
          </div>

          @if (errorMessage()) {
            <p class="form-error" role="alert">{{ errorMessage() }}</p>
          }

          <button type="submit" [disabled]="submitDisabled()" class="primary-button">
            @if (isSubmitting()) {
              <span>Registrando...</span>
            } @else {
              <span>Crear cuenta</span>
            }
          </button>
        </form>

        <footer class="auth-footer">
          <span>¿Ya tienes cuenta?</span>
          <a routerLink="/login">Iniciar sesión</a>
        </footer>
      </section>
    </main>
  `,
  styles: `
    .auth-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
      background: #f5f7fb;
    }
    .auth-card {
      width: min(420px, 100%);
      background: #ffffff;
      border-radius: 16px;
      padding: 2rem;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
      display: grid;
      gap: 1.5rem;
    }
    .auth-header h1 {
      margin: 0;
      font-size: 1.5rem;
      color: #0f172a;
    }
    .auth-header p {
      margin: 0.5rem 0 0;
      color: #475569;
    }
    .auth-form {
      display: grid;
      gap: 1rem;
    }
    .field {
      display: grid;
      gap: 0.5rem;
    }
    label {
      font-weight: 600;
      color: #0f172a;
    }
    input {
      padding: 0.65rem 0.75rem;
      border-radius: 8px;
      border: 1px solid #cbd5f5;
      font-size: 1rem;
    }
    input:focus-visible {
      outline: 3px solid #94a3ff;
      outline-offset: 1px;
    }
    .field-error {
      margin: 0;
      color: #b42318;
      font-size: 0.85rem;
    }
    .form-error {
      margin: 0;
      color: #b42318;
      background: #fff1f0;
      padding: 0.75rem;
      border-radius: 8px;
    }
    .primary-button {
      border: none;
      border-radius: 999px;
      padding: 0.75rem 1.5rem;
      background: #1d4ed8;
      color: #ffffff;
      font-weight: 600;
      cursor: pointer;
    }
    .primary-button[disabled] {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .auth-footer {
      display: flex;
      gap: 0.5rem;
      justify-content: center;
      color: #475569;
    }
    .auth-footer a {
      color: #1d4ed8;
      font-weight: 600;
    }
  `,
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
  // Signal Forms is experimental; this new app benefits from native reactive state and validation.
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
