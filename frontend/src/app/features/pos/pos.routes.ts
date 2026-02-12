import { Routes } from '@angular/router';

export const posRoutes: Routes = [
  {
    path: 'caja',
    loadComponent: () => import('./pages/pos-caja.page').then((m) => m.PosCajaPage),
  },
  {
    path: 'reportes',
    loadComponent: () => import('./pages/pos-reportes.page').then((m) => m.PosReportesPage),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'caja',
  },
];
