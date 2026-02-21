import { Routes } from '@angular/router';
import { PosCatalogShellComponent } from './components/catalog-shell/catalog-shell.component';

export const posCatalogRoutes: Routes = [
  {
    path: '',
    component: PosCatalogShellComponent,
    children: [
      {
        path: 'categories',
        loadComponent: () => import('./pages/categories/categories.page').then((m) => m.CategoriesPage),
      },
      {
        path: 'products',
        loadComponent: () => import('./pages/products/products.page').then((m) => m.ProductsPage),
      },
      {
        path: 'option-sets',
        loadComponent: () => import('./pages/option-sets/option-sets.page').then((m) => m.OptionSetsPage),
      },
      {
        path: 'schemas',
        loadComponent: () => import('./pages/schemas/schemas.page').then((m) => m.SchemasPage),
      },
      {
        path: 'extras',
        loadComponent: () => import('./pages/extras/extras.page').then((m) => m.ExtrasPage),
      },
      {
        path: 'included-items',
        loadComponent: () =>
          import('./pages/included-items/included-items.page').then((m) => m.IncludedItemsPage),
      },
      {
        path: 'overrides',
        loadComponent: () => import('./pages/overrides/overrides.page').then((m) => m.OverridesPage),
      },

      {
        path: 'inventory',
        loadComponent: () => import('./pages/inventory/inventory.page').then((m) => m.InventoryPage),
      },
      { path: '', pathMatch: 'full', redirectTo: 'categories' },
    ],
  },
];
