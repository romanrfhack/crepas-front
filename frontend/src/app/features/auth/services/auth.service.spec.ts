import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { StoreContextService } from '../../pos/services/store-context.service';
import { PlatformTenantContextService } from '../../platform/services/platform-tenant-context.service';
import { of } from 'rxjs';
import { ApiClient } from '../../../core/services/api-client';
import { AuthService } from './auth.service';

const createToken = (payload: Record<string, unknown>) => {
  const encodedPayload = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `header.${encodedPayload}.signature`;
};

const setupAuthService = (payload: Record<string, unknown> = { roles: ['AdminStore'] }) => {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: ApiClient,
        useValue: {
          post: () =>
            of({
              accessToken: createToken(payload),
              refreshToken: 'refresh-token',
            }),
        },
      },
    ],
  });

  return TestBed.inject(AuthService);
};

describe('AuthService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should prioritize cashier route over returnUrl', () => {
    localStorage.setItem('access_token', createToken({ roles: ['Cashier', 'AdminStore'] }));
    const service = setupAuthService();

    expect(service.resolvePostLoginUrl('/app/admin/users')).toBe('/app/pos/caja');
  });

  it('should respect returnUrl for admin-store users', () => {
    localStorage.setItem('access_token', createToken({ roles: ['AdminStore'] }));
    const service = setupAuthService();

    expect(service.resolvePostLoginUrl('/app/admin/users')).toBe('/app/admin/users');
  });

  it('should fallback to dashboard when returnUrl is invalid', () => {
    localStorage.setItem('access_token', createToken({ roles: ['AdminStore'] }));
    const service = setupAuthService();

    expect(service.resolvePostLoginUrl('https://evil.local')).toBe('/app/dashboard');
  });
  it('replaces legacy store and tenant context from an existing token', () => {
    localStorage.setItem('access_token', createToken({ sub: 'cashier-a', storeId: 'qa-store-a' }));
    localStorage.setItem('pos_active_store_id', 'another-business-store');
    localStorage.setItem('platform_selected_tenant_id', 'another-tenant');
    localStorage.setItem('pos_catalog_snapshot_cache:another-business-store', '{"snapshot":{}}');
    localStorage.setItem('unrelated-preference', 'keep');
    setupAuthService();
    expect(TestBed.inject(StoreContextService).getActiveStoreId()).toBe('qa-store-a');
    expect(TestBed.inject(PlatformTenantContextService).getSelectedTenantId()).toBeNull();
    expect(localStorage.getItem('pos_catalog_snapshot_cache:another-business-store')).toBeNull();
    expect(localStorage.getItem('unrelated-preference')).toBe('keep');
  });

  it('clears context in memory and storage on logout', () => {
    const service = setupAuthService();
    const store = TestBed.inject(StoreContextService);
    const tenant = TestBed.inject(PlatformTenantContextService);
    store.setActiveStoreId('old-store');
    tenant.setSelectedTenantId('old-tenant');
    localStorage.setItem('pos_catalog_snapshot_cache:old-store', '{}');
    service.logout();
    expect(store.getActiveStoreId()).toBeNull();
    expect(tenant.getSelectedTenantId()).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
    expect(localStorage.getItem('pos_catalog_snapshot_cache:old-store')).toBeNull();
  });

  it('updates an already instantiated store context on login without reloading', () => {
    const service = setupAuthService({ sub: 'cashier-b', tenantId: 'tenant-b', storeId: 'store-b' });
    const store = TestBed.inject(StoreContextService);
    store.setActiveStoreId('store-a');
    TestBed.inject(PlatformTenantContextService).setSelectedTenantId('tenant-a');
    service.login({ email: 'b@example.com', password: 'test' }).subscribe();
    expect(store.getActiveStoreId()).toBe('store-b');
    expect(TestBed.inject(PlatformTenantContextService).getSelectedTenantId()).toBeNull();
  });

  it('keeps the selected context when refreshing the same session', () => {
    const payload = { sub: 'admin-a', tenantId: 'tenant-a', storeId: 'store-a' };
    localStorage.setItem('access_token', createToken(payload));
    const service = setupAuthService(payload);
    const store = TestBed.inject(StoreContextService);
    store.setActiveStoreId('selected-store');
    TestBed.inject(PlatformTenantContextService).setSelectedTenantId('selected-tenant');
    localStorage.setItem('pos_catalog_snapshot_cache:selected-store', '{}');
    service.refresh({ refreshToken: 'refresh' }).subscribe();
    expect(store.getActiveStoreId()).toBe('selected-store');
    expect(TestBed.inject(PlatformTenantContextService).getSelectedTenantId()).toBe('selected-tenant');
    expect(localStorage.getItem('pos_catalog_snapshot_cache:selected-store')).toBe('{}');
  });

  it('reloads stale screens when another tab changes the access token', () => {
    const service = setupAuthService();
    const reload = vi.spyOn(service as unknown as { reloadBrowserSession(): void }, 'reloadBrowserSession')
      .mockImplementation(() => undefined);
    localStorage.setItem('access_token', createToken({ sub: 'other-user' }));
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'access_token', storageArea: localStorage,
    }));
    expect(reload).toHaveBeenCalledOnce();
  });

  it('resets selected context when refreshed claims change tenant or store', () => {
    localStorage.setItem('access_token', createToken({ sub: 'admin', tenantId: 'tenant-a', storeId: 'store-a' }));
    const service = setupAuthService({ sub: 'admin', tenantId: 'tenant-b', storeId: 'store-b' });
    const store = TestBed.inject(StoreContextService);
    store.setActiveStoreId('old-selection');
    service.refresh({ refreshToken: 'refresh' }).subscribe();
    expect(store.getActiveStoreId()).toBe('store-b');
  });

  it('does not restore a previous store for a user without a store claim', () => {
    const service = setupAuthService({ sub: 'platform-admin', roles: ['SuperAdmin'] });
    TestBed.inject(StoreContextService).setActiveStoreId('previous-store');
    service.login({ email: 'admin@example.com', password: 'test' }).subscribe();
    expect(TestBed.inject(StoreContextService).getActiveStoreId()).toBeNull();
  });

  it('preserves owned selections on reload of the same session', () => {
    const payload = { sub: 'admin', tenantId: 'tenant-a', storeId: 'store-a' };
    const service = setupAuthService(payload);
    service.login({ email: 'admin@example.com', password: 'test' }).subscribe();
    TestBed.inject(StoreContextService).setActiveStoreId('selected-store');
    TestBed.inject(PlatformTenantContextService).setSelectedTenantId('selected-tenant');
    setupAuthService(payload);
    expect(TestBed.inject(StoreContextService).getActiveStoreId()).toBe('selected-store');
    expect(TestBed.inject(PlatformTenantContextService).getSelectedTenantId()).toBe('selected-tenant');
  });
  it('accepts token renewal from another tab without discarding the same account screen', () => {
    const payload = { sub: 'same-user', storeId: 'same-store' };
    localStorage.setItem('access_token', createToken(payload));
    const service = setupAuthService(payload);
    const reload = vi.spyOn(service as unknown as { reloadBrowserSession(): void }, 'reloadBrowserSession')
      .mockImplementation(() => undefined);
    const renewed = createToken({ ...payload, exp: 9999999999 });
    localStorage.setItem('access_token', renewed);
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'access_token', storageArea: localStorage,
    }));
    expect(reload).not.toHaveBeenCalled();
    expect(service.getAccessToken()).toBe(renewed);
    expect(TestBed.inject(StoreContextService).getActiveStoreId()).toBe('same-store');
  });
});
