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
    defaultExpanded: true,
    children: [
      {
        label: 'Dashboard',
        path: '/app/dashboard',
      },
    ],
  },
  {
    label: 'Admin',
    roles: ['Admin'],
    defaultExpanded: true,
    children: [
      {
        label: 'Users',
        path: '/app/admin/users',
        roles: ['Admin'],
      },
      {
        label: 'Roles',
        path: '/app/admin/roles',
        roles: ['Admin'],
      },
      {
        label: 'POS Catálogo',
        path: '/app/admin/pos/catalog/categories',
        roles: ['Admin'],
        children: [
          {
            label: 'Categories',
            path: '/app/admin/pos/catalog/categories',
            roles: ['Admin'],
          },
          {
            label: 'Products',
            path: '/app/admin/pos/catalog/products',
            roles: ['Admin'],
          },
          {
            label: 'Option Sets',
            path: '/app/admin/pos/catalog/option-sets',
            roles: ['Admin'],
          },
          {
            label: 'Schemas',
            path: '/app/admin/pos/catalog/schemas',
            roles: ['Admin'],
          },
          {
            label: 'Extras',
            path: '/app/admin/pos/catalog/extras',
            roles: ['Admin'],
          },
          {
            label: 'Included Items',
            path: '/app/admin/pos/catalog/included-items',
            roles: ['Admin'],
          },
          {
            label: 'Overrides',
            path: '/app/admin/pos/catalog/overrides',
            roles: ['Admin'],
          },
        ],
      },
    ],
  },
];
