import { Routes } from '@angular/router';

export const posRoutes: Routes = [
  {
    path: 'caja',
    loadComponent: () => import('./pages/pos-caja.page').then((m) => m.PosCajaPage),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'caja',
  },
];
