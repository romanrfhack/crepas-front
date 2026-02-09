import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../auth/services/auth.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink],
  template: `
    <div class="app-shell">
      <header class="app-header">
        <div class="brand">
          <span class="brand-title">Cobranza Digital</span>
          <span class="brand-subtitle">Panel protegido</span>
        </div>
        <nav class="nav-actions" aria-label="Acciones principales">
          <a routerLink="/app/dashboard" class="nav-link">Dashboard</a>
          @if (isAuthenticatedSig()) {
            <span class="session-status" aria-live="polite">Sesión iniciada</span>
            <button type="button" class="ghost-button" (click)="onLogout()">Cerrar sesión</button>
          }
        </nav>
      </header>

      <main class="app-main">
        <router-outlet />
      </main>
    </div>
  `,
  styles: `
    .app-shell {
      min-height: 100vh;
      background: #f8fafc;
      color: #0f172a;
      display: flex;
      flex-direction: column;
    }
    .app-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.5rem 2rem;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .brand {
      display: grid;
      gap: 0.25rem;
    }
    .brand-title {
      font-size: 1.25rem;
      font-weight: 700;
    }
    .brand-subtitle {
      font-size: 0.9rem;
      color: #64748b;
    }
    .nav-actions {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      flex-wrap: wrap;
    }
    .nav-link {
      color: #1d4ed8;
      font-weight: 600;
      text-decoration: none;
    }
    .nav-link:focus-visible,
    .ghost-button:focus-visible {
      outline: 3px solid #94a3ff;
      outline-offset: 2px;
    }
    .ghost-button {
      background: transparent;
      border: 1px solid #cbd5f5;
      border-radius: 999px;
      padding: 0.5rem 1rem;
      color: #1d4ed8;
      font-weight: 600;
      cursor: pointer;
    }
    .session-status {
      font-size: 0.95rem;
      color: #0f172a;
      font-weight: 600;
    }
    .app-main {
      flex: 1;
      padding: 2rem;
      display: flex;
      justify-content: center;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  readonly isAuthenticatedSig = this.authService.isAuthenticatedSig;

  onLogout() {
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }
}
