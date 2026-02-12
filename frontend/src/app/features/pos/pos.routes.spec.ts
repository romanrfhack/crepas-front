import { posRoutes } from './pos.routes';

describe('posRoutes', () => {
  it('should expose lazy caja route', () => {
    const route = posRoutes.find((item) => item.path === 'caja');
    expect(route).toBeDefined();
    expect(route?.loadComponent).toBeDefined();
  });
});
