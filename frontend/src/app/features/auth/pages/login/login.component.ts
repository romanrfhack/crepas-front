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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../services/auth.service';

interface LoginModel {
  email: string;
  password: string;
}

@Component({
  selector: 'app-login',
  imports: [FormField, RouterLink],
  template: `
    <main class="auth-container">
      <section class="auth-card" aria-labelledby="login-title">
        <header class="auth-header">
          <h1 id="login-title">Iniciar sesión</h1>
          <p>Ingresa con tus credenciales para continuar.</p>
        </header>

        <form (submit)="onSubmit($event)" class="auth-form" novalidate>
          <div class="field">
            <label for="login-email">Correo</label>
            <input
              id="login-email"
              type="email"
              [formField]="fieldTree.email"
              autocomplete="email"
              [attr.aria-invalid]="emailInvalid()"
              [attr.aria-required]="true"
            />
            @if (emailInvalid()) {
              <p class="field-error" role="alert">{{ emailErrorMessage() }}</p>
            }
          </div>

          <div class="field">
            <label for="login-password">Contraseña</label>
            <input
              id="login-password"
              type="password"
              [formField]="fieldTree.password"
              autocomplete="current-password"
              [attr.aria-invalid]="passwordInvalid()"
              [attr.aria-required]="true"
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
              <span>Ingresando...</span>
            } @else {
              <span>Entrar</span>
            }
          </button>
        </form>

        <footer class="auth-footer">
          <span>¿No tienes cuenta?</span>
          <a routerLink="/register">Crear cuenta</a>
        </footer>
      </section>
    </main>
  `,
    styles: `
    :host {
      /* Paleta alineada a tu menú + fondo */
      --brand-rose: #f3b6c2;
      --brand-rose-strong: #e89aac;
      --brand-cream: #fbf6ef;
      --brand-cocoa: #6b3f2a;
      --brand-ink: #0f172a;
      --brand-muted: #475569;

      --ring: rgba(232, 154, 172, 0.55);
      --border: rgba(243, 182, 194, 0.35);
      --shadow: 0 20px 60px rgba(15, 23, 42, 0.14);
    }

    .auth-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;

      /* padding responsivo */
      padding: clamp(1.25rem, 3vw, 3rem);

      /* Fondo: imagen + overlays para asegurar legibilidad del card */
      background-color: var(--brand-cream);
      background-image:
        radial-gradient(1100px 700px at 70% 35%,
          rgba(255, 255, 255, 0.78),
          rgba(255, 255, 255, 0.38) 35%,
          rgba(255, 255, 255, 0) 72%),
        linear-gradient(90deg,
          rgba(243, 182, 194, 0.28) 0%,
          rgba(251, 246, 239, 0.88) 55%,
          rgba(251, 246, 239, 1) 100%),
        url('/assets/fondoLogin.webp');

      background-repeat: no-repeat;
      background-size: cover;

      /* Mantiene el “lado con espacio” para el formulario */
      background-position: center;
    }

    /* En desktop, empuja el card hacia la derecha para respetar el “safe area” */
    @media (min-width: 900px) {
      .auth-container {
        justify-content: flex-end;
      }
      .auth-card {
        margin-right: clamp(0rem, 6vw, 6rem);
      }
    }

    .auth-card {
      width: min(420px, 100%);
      padding: 2rem;
      display: grid;
      gap: 1.5rem;

      border-radius: 22px;
      border: 1px solid var(--border);
      box-shadow: var(--shadow);

      /* glass */
      background: rgba(255, 255, 255, 0.78);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }

    .auth-header h1 {
      margin: 0;
      font-size: 1.55rem;
      letter-spacing: 0.2px;
      color: var(--brand-ink);
    }

    .auth-header p {
      margin: 0.5rem 0 0;
      color: var(--brand-muted);
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
      font-weight: 650;
      color: var(--brand-ink);
    }

    input {
      padding: 0.7rem 0.8rem;
      border-radius: 12px;
      border: 1px solid rgba(107, 63, 42, 0.16);
      background: rgba(255, 255, 255, 0.9);
      font-size: 1rem;
      transition: border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease;
    }

    input:hover {
      border-color: rgba(232, 154, 172, 0.45);
    }

    input:focus-visible {
      outline: 3px solid var(--ring);
      outline-offset: 1px;
      border-color: rgba(232, 154, 172, 0.55);
      box-shadow: 0 0 0 4px rgba(232, 154, 172, 0.16);
    }

    .field-error {
      margin: 0;
      color: #b42318;
      font-size: 0.85rem;
    }

    .form-error {
      margin: 0;
      color: #7a1a12;
      background: rgba(243, 182, 194, 0.22);
      border: 1px solid rgba(243, 182, 194, 0.35);
      padding: 0.75rem;
      border-radius: 12px;
    }

    .primary-button {
      border: none;
      border-radius: 999px;
      padding: 0.85rem 1.5rem;
      color: #ffffff;
      font-weight: 700;
      cursor: pointer;
      transition: transform 140ms ease, filter 140ms ease, box-shadow 140ms ease;

      /* rosa → caramelo (combina con waffle/chocolate) */
      background: linear-gradient(135deg, var(--brand-rose-strong), #c98d6a);
      box-shadow: 0 12px 26px rgba(201, 141, 106, 0.28);
    }

    .primary-button:hover:not([disabled]) {
      transform: translateY(-1px);
      filter: saturate(1.05) brightness(0.98);
    }

    .primary-button:focus-visible {
      outline: 3px solid var(--ring);
      outline-offset: 2px;
    }

    .primary-button[disabled] {
      opacity: 0.65;
      cursor: not-allowed;
      box-shadow: none;
      transform: none;
      filter: none;
    }

    .auth-footer {
      display: flex;
      gap: 0.5rem;
      justify-content: center;
      color: var(--brand-muted);
    }

    .auth-footer a {
      color: var(--brand-cocoa);
      font-weight: 700;
      text-decoration: none;
      border-bottom: 1px solid rgba(107, 63, 42, 0.25);
      transition: border-color 140ms ease, color 140ms ease;
    }

    .auth-footer a:hover {
      color: #4f2d1f;
      border-bottom-color: rgba(232, 154, 172, 0.65);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly activatedRoute = inject(ActivatedRoute);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly submitted = signal(false);
  readonly model = signal<LoginModel>({
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
    const returnUrl = this.activatedRoute.snapshot.queryParamMap.get('returnUrl');
    this.authService
      .loginAndRedirect(payload, returnUrl)
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => undefined,
        error: () => {
          this.errorMessage.set('No pudimos iniciar sesión. Intenta nuevamente.');
        },
      });
  }
}
