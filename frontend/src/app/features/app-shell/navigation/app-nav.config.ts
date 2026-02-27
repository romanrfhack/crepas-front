export interface NavItem {
  label: string;
  path: string;
  icon?: string;
  roles?: string[];
  children?: NavItem[];
}

export interface NavSection {
  label: string;
  roles?: string[];
  children: NavItem[];
  defaultExpanded?: boolean;
}

export const APP_NAV_CONFIG: NavSection[] = [
  {
    label: 'General',
    roles: ['AdminStore', 'SuperAdmin'],
    defaultExpanded: true,
    children: [
      {
        label: 'Dashboard',
        path: '/app/dashboard',
        roles: ['AdminStore', 'SuperAdmin'],
      },
    ],
  },
  {
    label: 'POS',
    roles: ['AdminStore', 'Cashier', 'Manager'],
    defaultExpanded: true,
    children: [
      {
        label: 'Caja POS',
        path: '/app/pos/caja',
        roles: ['AdminStore', 'Cashier'],
      },
      {
        label: 'Reportes',
        path: '/app/pos/reportes',
        roles: ['AdminStore', 'Manager'],
      },
    ],
  },
  {
    label: 'Admin',
    roles: ['AdminStore', 'Manager', 'TenantAdmin', 'SuperAdmin'],
    defaultExpanded: true,
    children: [
      {
        label: 'Users',
        path: '/app/admin/users',
        roles: ['AdminStore', 'TenantAdmin', 'SuperAdmin'],
      },
      {
        label: 'Roles',
        path: '/app/admin/roles',
        roles: ['AdminStore', 'TenantAdmin', 'SuperAdmin'],
      },
      {
        label: 'POS Catálogo',
        path: '/app/admin/pos/catalog/categories',
        roles: ['AdminStore', 'Manager', 'TenantAdmin', 'SuperAdmin'],
        children: [
          { label: 'Categories', path: '/app/admin/pos/catalog/categories', roles: ['AdminStore', 'Manager', 'TenantAdmin', 'SuperAdmin'] },
          { label: 'Products', path: '/app/admin/pos/catalog/products', roles: ['AdminStore', 'Manager', 'TenantAdmin', 'SuperAdmin'] },
          { label: 'Option Sets', path: '/app/admin/pos/catalog/option-sets', roles: ['AdminStore', 'Manager', 'TenantAdmin', 'SuperAdmin'] },
          { label: 'Schemas', path: '/app/admin/pos/catalog/schemas', roles: ['AdminStore', 'Manager', 'TenantAdmin', 'SuperAdmin'] },
          { label: 'Extras', path: '/app/admin/pos/catalog/extras', roles: ['AdminStore', 'Manager', 'TenantAdmin', 'SuperAdmin'] },
          { label: 'Included Items', path: '/app/admin/pos/catalog/included-items', roles: ['AdminStore', 'Manager', 'TenantAdmin', 'SuperAdmin'] },
          { label: 'Overrides', path: '/app/admin/pos/catalog/overrides', roles: ['AdminStore', 'Manager', 'TenantAdmin', 'SuperAdmin'] },
          { label: 'Inventory', path: '/app/admin/pos/inventory', roles: ['AdminStore', 'Manager', 'TenantAdmin', 'SuperAdmin'] },
        ],
      },
    ],
  },
  {
    label: 'Plataforma',
    roles: ['SuperAdmin'],
    defaultExpanded: true,
    children: [
      { label: 'Dashboard', path: '/app/platform/dashboard', roles: ['SuperAdmin'] },
      { label: 'Catalog Templates', path: '/app/platform/catalog-templates', roles: ['SuperAdmin'] },
      { label: 'Verticals', path: '/app/platform/verticals', roles: ['SuperAdmin'] },
      { label: 'Tenants', path: '/app/platform/tenants', roles: ['SuperAdmin'] },
      { label: 'Asignar template', path: '/app/platform/tenant-template-assignment', roles: ['SuperAdmin'] },
      { label: 'Contexto tenant', path: '/app/platform/tenant-context', roles: ['SuperAdmin'] },
    ],
  },
];
