import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';
import { AppShellComponent } from './app-shell.component';

export const appShellRoutes: Routes = [
  {
    path: '',
    component: AppShellComponent,
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('../weather-forecast/pages/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'admin',
        loadChildren: () => import('../admin/admin.routes').then((m) => m.adminRoutes),
      },
      {
        path: 'pos',
        canMatch: [roleGuard(['Admin', 'Cashier'])],
        canActivate: [roleGuard(['Admin', 'Cashier'])],
        data: { roles: ['Admin', 'Cashier'] },
        loadChildren: () => import('../pos/pos.routes').then((m) => m.posRoutes),
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
    ],
  },
];
