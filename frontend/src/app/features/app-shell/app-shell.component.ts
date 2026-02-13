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
      <header class="app-header">
        <div class="brand">
          <span class="brand-title">Cobranza Digital</span>
          <span class="brand-subtitle">Panel protegido</span>
        </div>
        <div class="header-actions">
          @if (isAuthenticatedSig()) {
            <button
              type="button"
              class="ghost-button ghost-button--menu"
              [attr.aria-label]="isSidenavOpen() ? 'Ocultar menú lateral' : 'Mostrar menú lateral'"
              [attr.aria-expanded]="isSidenavOpen()"
              (click)="onToggleSidenav()"
            >
              ☰
            </button>
            <span class="session-status" aria-live="polite">Sesión iniciada</span>
            <button type="button" class="ghost-button" (click)="onLogout()">Cerrar sesión</button>
          }
        </div>
      </header>

      @if (globalErrorMessage()) {
        <section class="global-error" role="alert" aria-live="assertive">
          <div class="global-error__content">
            <strong>Algo salió mal.</strong>
            <span>{{ globalErrorMessage() }}</span>
          </div>
          <button type="button" class="global-error__dismiss" (click)="onDismissError()">
            Cerrar
          </button>
        </section>
      }

      <div
        class="app-content-layout"
        [class.app-content-layout--sidebar-open]="isAuthenticatedSig() && isSidenavOpen()"
      >
        @if (isAuthenticatedSig() && isSidenavOpen()) {
          <aside class="app-sidebar" [attr.aria-hidden]="!isSidenavOpen()">
            <app-nav [navItems]="appNavItems" [userRoles]="rolesSig()" />
          </aside>
        }

        <main class="app-main" [class.app-main--full-width]="isFullWidthRoute()" aria-live="polite">
          <router-outlet></router-outlet>
        </main>
      </div>
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
    .header-actions {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      flex-wrap: wrap;
    }
    .ghost-button:focus-visible {
      outline: 3px solid #94a3ff;
      outline-offset: 2px;
    }
    .ghost-button--menu {
      font-size: 1.2rem;
      min-width: 2.5rem;
      padding-inline: 0.75rem;
      color: #0f172a;
      border-color: #cbd5e1;
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
    .app-content-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 1.5rem;
      flex: 1;
      padding: 1.5rem 2rem 2rem;
      align-items: start;
    }
    .app-content-layout--sidebar-open {
      grid-template-columns: minmax(220px, 300px) minmax(0, 1fr);
    }
    .app-sidebar {
      position: sticky;
      top: 1.5rem;
      align-self: start;
    }
    .app-main {
      min-width: 0;
      display: flex;
      justify-content: center;
    }
    .app-main--full-width > * {
      width: 100%;
    }
    .global-error {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin: 1.5rem 2rem 0;
      padding: 1rem 1.5rem;
      border-radius: 0.75rem;
      background: #fee2e2;
      border: 1px solid #fecaca;
      color: #7f1d1d;
      font-weight: 600;
    }
    .global-error__content {
      display: grid;
      gap: 0.25rem;
    }
    .global-error__dismiss {
      border: 1px solid #fca5a5;
      background: #ffffff;
      color: #7f1d1d;
      border-radius: 999px;
      padding: 0.4rem 0.9rem;
      font-weight: 600;
      cursor: pointer;
    }
    .global-error__dismiss:focus-visible {
      outline: 3px solid #f87171;
      outline-offset: 2px;
    }

    @media (max-width: 1024px) {
      .app-content-layout,
      .app-content-layout--sidebar-open {
        grid-template-columns: 1fr;
      }

      .app-sidebar {
        position: static;
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
