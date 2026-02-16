import { StoreContextService } from './store-context.service';

describe('StoreContextService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists active store id in localStorage and reads it back', () => {
    const service = new StoreContextService();

    service.setActiveStoreId('  store-abc  ');

    expect(service.getActiveStoreId()).toBe('store-abc');
    expect(localStorage.getItem('pos_active_store_id')).toBe('store-abc');

    const anotherInstance = new StoreContextService();
    expect(anotherInstance.getActiveStoreId()).toBe('store-abc');
  });

  it('clears persisted key when receiving empty value', () => {
    const service = new StoreContextService();

    service.setActiveStoreId('store-abc');
    service.setActiveStoreId('   ');

    expect(service.getActiveStoreId()).toBeNull();
    expect(localStorage.getItem('pos_active_store_id')).toBeNull();
  });
});
