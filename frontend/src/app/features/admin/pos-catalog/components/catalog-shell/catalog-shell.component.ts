import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-pos-catalog-shell',
  imports: [RouterLink, RouterOutlet],
  template: `
    <section class="admin-page">
      <header class="page-header">
        <h1>POS Catálogo</h1>
        <p>Administra categorías, productos, esquemas y reglas de personalización.</p>
      </header>

      <nav class="catalog-nav" aria-label="Secciones de catálogo POS">
        <a routerLink="categories">Categorías</a>
        <a routerLink="products">Productos</a>
        <a routerLink="option-sets">Option sets</a>
        <a routerLink="schemas">Schemas</a>
        <a routerLink="extras">Extras</a>
        <a routerLink="included-items">Incluidos</a>
        <a routerLink="overrides">Overrides</a>
      </nav>

      <router-outlet />
    </section>
  `,
  styles: `
    .admin-page {
      width: min(1100px, 100%);
      display: grid;
      gap: 1rem;
    }
    .page-header h1 {
      margin: 0;
    }
    .page-header p {
      margin: 0.25rem 0 0;
      color: #475569;
    }
    .catalog-nav {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .catalog-nav a {
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 0.35rem 0.85rem;
      text-decoration: none;
      color: #1d4ed8;
      font-weight: 600;
      background: #ffffff;
    }
    .catalog-nav a:focus-visible {
      outline: 3px solid #94a3ff;
      outline-offset: 2px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PosCatalogShellComponent {}
