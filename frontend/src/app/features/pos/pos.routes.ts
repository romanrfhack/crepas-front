import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';

export const posRoutes: Routes = [
  {
    path: 'caja',
    canMatch: [roleGuard(['AdminStore', 'Admin', 'Cashier'])],
    canActivate: [roleGuard(['AdminStore', 'Admin', 'Cashier'])],
    loadComponent: () => import('./pages/pos-caja.page').then((m) => m.PosCajaPage),
    data: { title: 'Caja POS', roles: ['AdminStore', 'Admin', 'Cashier'] },
  },
  {
    path: 'reportes',
    canMatch: [roleGuard(['AdminStore', 'Admin', 'Manager'])],
    canActivate: [roleGuard(['AdminStore', 'Admin', 'Manager'])],
    loadComponent: () => import('./pages/pos-reportes.page').then((m) => m.PosReportesPage),
    data: { roles: ['AdminStore', 'Admin', 'Manager'] },
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'caja',
  },
];
