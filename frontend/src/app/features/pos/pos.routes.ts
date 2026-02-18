import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';

export const posRoutes: Routes = [
  {
    path: 'caja',
    canMatch: [roleGuard(['Admin', 'Cashier'])],
    canActivate: [roleGuard(['Admin', 'Cashier'])],
    loadComponent: () => import('./pages/pos-caja.page').then((m) => m.PosCajaPage),
    data: { title: 'Caja POS', roles: ['Admin', 'Cashier'] },
  },
  {
    path: 'reportes',
    canMatch: [roleGuard(['Admin', 'Manager'])],
    canActivate: [roleGuard(['Admin', 'Manager'])],
    loadComponent: () => import('./pages/pos-reportes.page').then((m) => m.PosReportesPage),
    data: { roles: ['Admin', 'Manager'] },
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'caja',
  },
];
