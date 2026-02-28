import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';

export const platformRoutes: Routes = [
  {
    path: 'dashboard',
    canMatch: [roleGuard(['SuperAdmin'])],
    canActivate: [roleGuard(['SuperAdmin'])],
    data: { roles: ['SuperAdmin'] },
    loadComponent: () =>
      import('./pages/dashboard/platform-dashboard.page').then((m) => m.PlatformDashboardPage),
  },
  {
    path: 'catalog-templates',
    canMatch: [roleGuard(['SuperAdmin'])],
    canActivate: [roleGuard(['SuperAdmin'])],
    data: { roles: ['SuperAdmin'] },
    loadComponent: () =>
      import('./pages/catalog-templates/catalog-templates.page').then((m) => m.CatalogTemplatesPage),
  },
  {
    path: 'tenant-template-assignment',
    canMatch: [roleGuard(['SuperAdmin'])],
    canActivate: [roleGuard(['SuperAdmin'])],
    data: { roles: ['SuperAdmin'] },
    loadComponent: () =>
      import('./pages/tenant-template-assignment/tenant-template-assignment.page').then(
        (m) => m.TenantTemplateAssignmentPage,
      ),
  },
  {
    path: 'verticals',
    canMatch: [roleGuard(['SuperAdmin'])],
    canActivate: [roleGuard(['SuperAdmin'])],
    data: { roles: ['SuperAdmin'] },
    loadComponent: () => import('./pages/verticals/verticals.page').then((m) => m.VerticalsPage),
  },
  {
    path: 'tenants',
    canMatch: [roleGuard(['SuperAdmin'])],
    canActivate: [roleGuard(['SuperAdmin'])],
    data: { roles: ['SuperAdmin'] },
    loadComponent: () => import('./pages/tenants/tenants.page').then((m) => m.TenantsPage),
  },
  {
    path: 'tenants/:tenantId/stores',
    canMatch: [roleGuard(['SuperAdmin'])],
    canActivate: [roleGuard(['SuperAdmin'])],
    data: { roles: ['SuperAdmin'] },
    loadComponent: () =>
      import('./pages/tenant-stores/tenant-stores.page').then((m) => m.TenantStoresPage),
  },
  {
    path: 'stores/:storeId',
    canMatch: [roleGuard(['SuperAdmin'])],
    canActivate: [roleGuard(['SuperAdmin'])],
    data: { roles: ['SuperAdmin'] },
    loadComponent: () =>
      import('./pages/store-details/store-details.page').then((m) => m.StoreDetailsPage),
  },
  {
    path: 'tenant-context',
    canMatch: [roleGuard(['SuperAdmin'])],
    canActivate: [roleGuard(['SuperAdmin'])],
    data: { roles: ['SuperAdmin'] },
    loadComponent: () =>
      import('./pages/tenant-context/tenant-context.page').then((m) => m.TenantContextPage),
  },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
];
