import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';

export const platformRoutes: Routes = [
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
    path: 'tenant-context',
    canMatch: [roleGuard(['SuperAdmin'])],
    canActivate: [roleGuard(['SuperAdmin'])],
    data: { roles: ['SuperAdmin'] },
    loadComponent: () =>
      import('./pages/tenant-context/tenant-context.page').then((m) => m.TenantContextPage),
  },
  { path: '', pathMatch: 'full', redirectTo: 'catalog-templates' },
];
