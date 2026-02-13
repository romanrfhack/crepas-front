import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-pos-catalog-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="catalog-shell">
      <!-- HEADER con barra decorativa -->
      <header class="page-header">
        <h1>📦 POS Catálogo</h1>
        <p class="page-subtitle">
          Administra categorías, productos, esquemas y reglas de personalización
        </p>
        <div class="header-decoration"></div>
      </header>

      <!-- NAVEGACIÓN EN PÍLDORAS -->
      <nav class="catalog-nav" aria-label="Secciones de catálogo POS">
        <a
          routerLink="categories"
          routerLinkActive="catalog-nav__link--active"
          class="catalog-nav__link"
          [routerLinkActiveOptions]="{ exact: true }"
        >
          Categorías
        </a>
        <a
          routerLink="products"
          routerLinkActive="catalog-nav__link--active"
          class="catalog-nav__link"
        >
          Productos
        </a>
        <a
          routerLink="option-sets"
          routerLinkActive="catalog-nav__link--active"
          class="catalog-nav__link"
        >
          Option sets
        </a>
        <a
          routerLink="schemas"
          routerLinkActive="catalog-nav__link--active"
          class="catalog-nav__link"
        >
          Schemas
        </a>
        <a
          routerLink="extras"
          routerLinkActive="catalog-nav__link--active"
          class="catalog-nav__link"
        >
          Extras
        </a>
        <a
          routerLink="included-items"
          routerLinkActive="catalog-nav__link--active"
          class="catalog-nav__link"
        >
          Incluidos
        </a>
        <a
          routerLink="overrides"
          routerLinkActive="catalog-nav__link--active"
          class="catalog-nav__link"
        >
          Overrides
        </a>
      </nav>

      <!-- CONTENIDO DINÁMICO -->
      <div class="catalog-content">
        <router-outlet />
      </div>
    </div>
  `,
  styles: `
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

    .catalog-shell {
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
      padding: 1.5rem;
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
    }

    /* ===== HEADER ===== */
    .page-header {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      position: relative;
    }

    .page-header h1 {
      font-size: 1.75rem;
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
      font-size: 1rem;
      font-weight: 500;
    }

    .header-decoration {
      width: 80px;
      height: 4px;
      background: linear-gradient(90deg, var(--brand-rose-strong), #c98d6a);
      border-radius: 999px;
      margin-top: 0.5rem;
    }

    /* ===== NAVEGACIÓN EN PÍLDORAS ===== */
    .catalog-nav {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      padding: 0.25rem 0;
    }

    .catalog-nav__link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem 1.25rem;
      border-radius: 999px;
      font-weight: 600;
      font-size: 0.9rem;
      text-decoration: none;
      color: var(--brand-cocoa);
      background: white;
      border: 1px solid var(--border);
      transition: all var(--transition);
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.02);
    }

    .catalog-nav__link:hover {
      background: rgba(243, 182, 194, 0.1);
      border-color: var(--brand-rose-strong);
      transform: translateY(-2px);
      box-shadow: var(--shadow-sm);
    }

    .catalog-nav__link--active {
      background: linear-gradient(135deg, var(--brand-rose-strong), #c98d6a);
      color: white;
      border-color: transparent;
      box-shadow: 0 6px 16px rgba(201, 141, 106, 0.25);
    }

    .catalog-nav__link--active:hover {
      background: linear-gradient(135deg, #d88b9c, #b87a5a);
      box-shadow: 0 10px 22px rgba(201, 141, 106, 0.35);
      transform: translateY(-2px);
    }

    .catalog-nav__link:focus-visible {
      outline: 3px solid var(--ring);
      outline-offset: 2px;
    }

    /* ===== CONTENEDOR DEL CONTENIDO ===== */
    .catalog-content {
      background: rgba(255, 255, 255, 0.4);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 1.5rem;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.02);
      transition: border-color var(--transition);
    }

    .catalog-content:hover {
      border-color: rgba(232, 154, 172, 0.3);
    }

    /* ===== RESPONSIVE ===== */
    @media (max-width: 700px) {
      .catalog-shell {
        padding: 1rem;
      }

      .page-header h1 {
        font-size: 1.5rem;
      }

      .catalog-nav {
        gap: 0.4rem;
      }

      .catalog-nav__link {
        padding: 0.4rem 0.9rem;
        font-size: 0.85rem;
      }

      .catalog-content {
        padding: 1rem;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PosCatalogShellComponent {}