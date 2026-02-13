import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Data, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { GlobalErrorService } from '../../core/services/global-error.service';
import { AuthService } from '../auth/services/auth.service';
import { AppNavComponent } from './components/app-nav/app-nav.component';
import { APP_NAV_CONFIG } from './navigation/app-nav.config';

const SIDENAV_STORAGE_KEY = 'app-shell:sidenav';

@Component({
  selector: 'app-shell',
  host: {
    '(document:keydown.escape)': 'onEscapeClose()',
  },
  imports: [RouterOutlet, AppNavComponent],
  template: `
    <div class="app-shell">
      <!-- HEADER con gradiente y diseño refinado -->
      <header class="app-header">
        <div class="brand">
          <span class="brand-title">Cobranza Digital</span>
          <span class="brand-subtitle">Panel protegido</span>
        </div>
        <div class="header-actions">
          @if (isAuthenticatedSig()) {
            <button
              type="button"
              class="btn-icon"
              [attr.aria-label]="isSidenavOpen() ? 'Ocultar menú lateral' : 'Mostrar menú lateral'"
              [attr.aria-expanded]="isSidenavOpen()"
              (click)="onToggleSidenav()"
            >
              <span class="hamburger-icon">☰</span>
            </button>

            <span class="session-badge" aria-live="polite">
              <span class="session-dot"></span>
              Sesión activa
            </span>

            <button type="button" class="btn-outline" (click)="onLogout()">
              <span>🚪</span>
              Cerrar sesión
            </button>
          }
        </div>
      </header>

      <!-- GLOBAL ERROR con estilo unificado -->
      @if (globalErrorMessage()) {
        <section class="global-error" role="alert" aria-live="assertive">
          <div class="global-error__content">
            <span class="global-error__icon">⚠️</span>
            <div>
              <strong>Algo salió mal.</strong>
              <span>{{ globalErrorMessage() }}</span>
            </div>
          </div>
          <button type="button" class="global-error__dismiss" (click)="onDismissError()">
            ✕ Cerrar
          </button>
        </section>
      }

      <!-- LAYOUT principal con sidebar adaptable -->
      <div
        class="app-content-layout"
        [class.app-content-layout--sidebar-open]="isAuthenticatedSig() && isSidenavOpen()"
      >
        @if (isAuthenticatedSig() && isSidenavOpen()) {
          <aside class="app-sidebar" [attr.aria-hidden]="!isSidenavOpen()">
            <div class="sidebar-container">
              <app-nav [navItems]="appNavItems" [userRoles]="rolesSig()" />
            </div>
          </aside>
        }

        <main
          class="app-main"
          [class.app-main--full-width]="isFullWidthRoute()"
          aria-live="polite"
        >
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      /* Variables de diseño: mismas que en el POS */
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
      --transition: 140ms ease;
    }

    .app-shell {
      min-height: 100vh;
      background: linear-gradient(145deg, #f9fbfd 0%, #f1f5f9 100%);
      color: var(--brand-ink);
      display: flex;
      flex-direction: column;
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
    }

    /* ===== HEADER ELEGANTE ===== */
    .app-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.9rem 2rem;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      box-shadow: 0 4px 20px rgba(15, 23, 42, 0.04);
      gap: 1rem;
      flex-wrap: wrap;
      position: sticky;
      top: 0;
      z-index: 40;
    }

    .brand {
      display: grid;
      gap: 0.2rem;
    }

    .brand-title {
      font-size: 1.35rem;
      font-weight: 800;
      color: var(--brand-cocoa);
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, var(--brand-cocoa), #8b5e4c);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .brand-subtitle {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--brand-muted);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .header-actions {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      flex-wrap: wrap;
    }

    /* Botón de menú (hamburguesa) */
    .btn-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: 999px;
      background: white;
      border: 1px solid var(--border);
      color: var(--brand-cocoa);
      font-size: 1.5rem;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--transition);
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.02);
    }

    .btn-icon:hover {
      background: rgba(243, 182, 194, 0.12);
      border-color: var(--brand-rose-strong);
      transform: translateY(-2px);
      box-shadow: var(--shadow-sm);
    }

    .btn-icon:focus-visible {
      outline: 3px solid var(--ring);
      outline-offset: 2px;
    }

    .hamburger-icon {
      display: inline-block;
      transition: transform var(--transition);
    }

    .btn-icon:hover .hamburger-icon {
      transform: scale(1.1);
    }

    /* Badge de sesión activa */
    .session-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 999px;
      padding: 0.4rem 1rem;
      font-size: 0.9rem;
      font-weight: 600;
      color: #065f46;
      backdrop-filter: blur(4px);
    }

    .session-dot {
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 999px;
      display: inline-block;
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    /* Botón de cerrar sesión (outline) */
    .btn-outline {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: white;
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 0.5rem 1.2rem;
      font-weight: 600;
      color: var(--brand-cocoa);
      transition: all var(--transition);
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.02);
    }

    .btn-outline:hover {
      background: rgba(243, 182, 194, 0.1);
      border-color: var(--brand-rose-strong);
      transform: translateY(-2px);
      box-shadow: var(--shadow-sm);
    }

    .btn-outline:focus-visible {
      outline: 3px solid var(--ring);
      outline-offset: 2px;
    }

    /* ===== GLOBAL ERROR (coherente con POS) ===== */
    .global-error {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin: 1.5rem 2rem 0;
      padding: 1rem 1.5rem;
      border-radius: var(--radius-md);
      background: rgba(180, 35, 24, 0.08);
      border: 1px solid rgba(180, 35, 24, 0.2);
      color: #b42318;
      font-weight: 500;
      backdrop-filter: blur(4px);
      box-shadow: 0 8px 20px rgba(180, 35, 24, 0.08);
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

    .global-error__content {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .global-error__icon {
      font-size: 1.3rem;
    }

    .global-error__dismiss {
      border: 1px solid rgba(180, 35, 24, 0.3);
      background: white;
      color: #b42318;
      border-radius: 999px;
      padding: 0.4rem 1.2rem;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all var(--transition);
    }

    .global-error__dismiss:hover {
      background: #b42318;
      color: white;
      border-color: transparent;
      transform: translateY(-1px);
      box-shadow: 0 6px 14px rgba(180, 35, 24, 0.25);
    }

    .global-error__dismiss:focus-visible {
      outline: 3px solid rgba(180, 35, 24, 0.5);
      outline-offset: 2px;
    }

    /* ===== LAYOUT PRINCIPAL ===== */
    .app-content-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 1.5rem;
      flex: 1;
      padding: 1.75rem 2rem 2rem;
      align-items: start;
      transition: grid-template-columns var(--transition);
    }

    .app-content-layout--sidebar-open {
      grid-template-columns: minmax(240px, 280px) minmax(0, 1fr);
      gap: 1.75rem;
    }

    /* Sidebar con estilo de tarjeta elegante */
    .app-sidebar {
      position: sticky;
      top: calc(70px + 1.5rem); /* altura aprox del header + espacio */
      align-self: start;
    }

    .sidebar-container {
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      padding: 1rem 0.75rem;
      transition: all var(--transition);
    }

    /* Main content */
    .app-main {
      min-width: 0;
      display: flex;
      justify-content: center;
    }

    .app-main--full-width > * {
      width: 100%;
    }

    /* ===== RESPONSIVE ===== */
    @media (max-width: 1024px) {
      .app-content-layout,
      .app-content-layout--sidebar-open {
        grid-template-columns: 1fr;
      }

      .app-sidebar {
        position: static;
      }

      .sidebar-container {
        width: 100%;
      }
    }

    @media (max-width: 700px) {
      .app-header {
        padding: 0.75rem 1rem;
      }

      .brand-title {
        font-size: 1.1rem;
      }

      .brand-subtitle {
        display: none;
      }

      .header-actions {
        gap: 0.5rem;
      }

      .btn-outline span:first-child {
        margin-right: 0;
      }

      .btn-outline span:last-child {
        display: none;
      }

      .session-badge span:last-child {
        display: none;
      }

      .session-badge {
        padding: 0.4rem 0.6rem;
      }

      .global-error {
        margin: 1rem 1rem 0;
        flex-wrap: wrap;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly globalErrorService = inject(GlobalErrorService);

  readonly appNavItems = APP_NAV_CONFIG;
  readonly isAuthenticatedSig = this.authService.isAuthenticatedSig;
  readonly rolesSig = this.authService.rolesSig;
  readonly globalErrorMessage = this.globalErrorService.message;
  readonly isCashier = computed(() => this.authService.hasRole('Cashier'));
  readonly isSidenavOpen = signal(true);
  private readonly activeRouteData = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.getActiveRouteData()),
    ),
    { initialValue: this.getActiveRouteData() },
  );
  readonly isFullWidthRoute = computed(() => this.activeRouteData()?.['fullWidth'] === true);

  private readonly sidenavStorageKey = computed(
    () => `${SIDENAV_STORAGE_KEY}:${this.authService.sessionScopeSig()}`,
  );

  private readonly syncSidenavState = effect(() => {
    if (!this.isAuthenticatedSig()) {
      this.isSidenavOpen.set(true);
      return;
    }

    const storageKey = this.sidenavStorageKey();
    const persistedValue = localStorage.getItem(storageKey);

    if (persistedValue === null) {
      this.isSidenavOpen.set(!this.isCashier());
      this.persistSidenavState();
      return;
    }

    this.isSidenavOpen.set(persistedValue === 'true');
  });

  onToggleSidenav() {
    this.isSidenavOpen.update((isOpen) => !isOpen);
    this.persistSidenavState();
  }

  onEscapeClose() {
    if (!this.isSidenavOpen()) {
      return;
    }

    this.isSidenavOpen.set(false);
    this.persistSidenavState();
  }

  onLogout() {
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }

  onDismissError() {
    this.globalErrorService.clear();
  }

  private persistSidenavState() {
    localStorage.setItem(this.sidenavStorageKey(), String(this.isSidenavOpen()));
  }

  private getDeepestRoute(route: ActivatedRoute): ActivatedRoute {
    let currentRoute = route;

    while (currentRoute.firstChild) {
      currentRoute = currentRoute.firstChild;
    }

    return currentRoute;
  }

  private getActiveRouteData(): Data {
    return this.getDeepestRoute(this.activatedRoute).snapshot?.data ?? {};
  }
}