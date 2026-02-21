import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';

export const adminRoutes: Routes = [
  {
    path: 'pos/catalog',
    canMatch: [roleGuard(['Admin', 'Manager', 'TenantAdmin', 'SuperAdmin'])],
    canActivate: [roleGuard(['Admin', 'Manager', 'TenantAdmin', 'SuperAdmin'])],
    data: { roles: ['Admin', 'Manager', 'TenantAdmin', 'SuperAdmin'] },
    loadChildren: () =>
      import('./pos-catalog/pos-catalog.routes').then((m) => m.posCatalogRoutes),
  },
  {
    path: 'users',
    canMatch: [roleGuard(['Admin'])],
    canActivate: [roleGuard(['Admin'])],
    data: { roles: ['Admin'] },
    loadComponent: () =>
      import('./pages/users-admin/users-admin.page').then((m) => m.UsersAdminPage),
  },
  {
    path: 'roles',
    canMatch: [roleGuard(['Admin'])],
    canActivate: [roleGuard(['Admin'])],
    data: { roles: ['Admin'] },
    loadComponent: () =>
      import('./pages/roles-admin/roles-admin.page').then((m) => m.RolesAdminPage),
  },
];
