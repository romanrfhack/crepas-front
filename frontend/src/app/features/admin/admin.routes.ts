import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';

export const adminRoutes: Routes = [

  {
    path: 'pos/inventory',
    canMatch: [roleGuard(['AdminStore', 'Manager', 'TenantAdmin', 'SuperAdmin'])],
    canActivate: [roleGuard(['AdminStore', 'Manager', 'TenantAdmin', 'SuperAdmin'])],
    data: { roles: ['AdminStore', 'Manager', 'TenantAdmin', 'SuperAdmin'] },
    loadComponent: () =>
      import('./pos-catalog/pages/inventory/inventory.page').then((m) => m.InventoryPage),
  },
  {
    path: 'pos/catalog',
    canMatch: [roleGuard(['AdminStore', 'Manager', 'TenantAdmin', 'SuperAdmin'])],
    canActivate: [roleGuard(['AdminStore', 'Manager', 'TenantAdmin', 'SuperAdmin'])],
    data: { roles: ['AdminStore', 'Manager', 'TenantAdmin', 'SuperAdmin'] },
    loadChildren: () =>
      import('./pos-catalog/pos-catalog.routes').then((m) => m.posCatalogRoutes),
  },
  {
    path: 'users',
    canMatch: [roleGuard(['AdminStore', 'TenantAdmin', 'SuperAdmin'])],
    canActivate: [roleGuard(['AdminStore', 'TenantAdmin', 'SuperAdmin'])],
    data: { roles: ['AdminStore', 'TenantAdmin', 'SuperAdmin'] },
    loadComponent: () =>
      import('./pages/users-admin/users-admin.page').then((m) => m.UsersAdminPage),
  },
  {
    path: 'roles',
    canMatch: [roleGuard(['AdminStore', 'TenantAdmin', 'SuperAdmin'])],
    canActivate: [roleGuard(['AdminStore', 'TenantAdmin', 'SuperAdmin'])],
    data: { roles: ['AdminStore', 'TenantAdmin', 'SuperAdmin'] },
    loadComponent: () =>
      import('./pages/roles-admin/roles-admin.page').then((m) => m.RolesAdminPage),
  },
];
