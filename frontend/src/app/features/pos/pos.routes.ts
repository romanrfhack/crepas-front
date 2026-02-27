import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';

export const posRoutes: Routes = [
  {
    path: 'caja',
    canMatch: [roleGuard(['AdminStore', 'Cashier'])],
    canActivate: [roleGuard(['AdminStore', 'Cashier'])],
    loadComponent: () => import('./pages/pos-caja.page').then((m) => m.PosCajaPage),
    data: { title: 'Caja POS', roles: ['AdminStore', 'Cashier'] },
  },
  {
    path: 'reportes',
    canMatch: [roleGuard(['AdminStore', 'Manager'])],
    canActivate: [roleGuard(['AdminStore', 'Manager'])],
    loadComponent: () => import('./pages/pos-reportes.page').then((m) => m.PosReportesPage),
    data: { roles: ['AdminStore', 'Manager'] },
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'caja',
  },
];
