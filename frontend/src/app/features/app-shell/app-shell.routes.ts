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
        path: 'platform',
        canMatch: [roleGuard(['SuperAdmin'])],
        canActivate: [roleGuard(['SuperAdmin'])],
        data: { roles: ['SuperAdmin'] },
        loadChildren: () => import('../platform/platform.routes').then((m) => m.platformRoutes),
      },
      {
        path: 'pos',
        canMatch: [roleGuard(['AdminStore', 'Admin', 'Cashier', 'Manager'])],
        canActivate: [roleGuard(['AdminStore', 'Admin', 'Cashier', 'Manager'])],
        data: { roles: ['AdminStore', 'Admin', 'Cashier', 'Manager'] },
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
