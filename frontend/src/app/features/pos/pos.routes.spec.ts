import { posRoutes } from './pos.routes';

describe('posRoutes', () => {
  it('should expose lazy caja route restricted to AdminStore/Cashier', () => {
    const route = posRoutes.find((item) => item.path === 'caja');
    expect(route).toBeDefined();
    expect(route?.loadComponent).toBeDefined();
    expect(route?.data?.['roles']).toEqual(['AdminStore', 'Cashier']);
  });

  it('should expose lazy reportes route restricted to AdminStore/Manager', () => {
    const route = posRoutes.find((item) => item.path === 'reportes');
    expect(route).toBeDefined();
    expect(route?.loadComponent).toBeDefined();
    expect(route?.data?.['roles']).toEqual(['AdminStore', 'Manager']);
  });
});
