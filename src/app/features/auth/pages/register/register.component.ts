import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <main class="auth-container">
      <section class="auth-card" aria-labelledby="register-title">
        <header class="auth-header">
          <h1 id="register-title">Crear cuenta</h1>
          <p>Completa los datos para registrarte.</p>
        </header>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="auth-form">
          <div class="field">
            <label for="register-email">Correo</label>
            <input
              id="register-email"
              type="email"
              formControlName="email"
              autocomplete="email"
              [attr.aria-invalid]="emailInvalid()"
              required
            />
            @if (emailInvalid()) {
              <p class="field-error" role="alert">Ingresa un correo válido.</p>
            }
          </div>

          <div class="field">
            <label for="register-password">Contraseña</label>
            <input
              id="register-password"
              type="password"
              formControlName="password"
              autocomplete="new-password"
              minlength="6"
              [attr.aria-invalid]="passwordInvalid()"
              required
            />
            @if (passwordInvalid()) {
              <p class="field-error" role="alert">
                La contraseña debe tener al menos 6 caracteres.
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
  private readonly formBuilder = inject(FormBuilder);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  readonly submitDisabled = computed(() => this.isSubmitting() || this.form.invalid);

  readonly emailInvalid = computed(() => {
    const control = this.form.controls.email;
    return control.invalid && (control.touched || control.dirty);
  });

  readonly passwordInvalid = computed(() => {
    const control = this.form.controls.password;
    return control.invalid && (control.touched || control.dirty);
  });

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set('');
    this.isSubmitting.set(true);
    const payload = this.form.getRawValue();
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
