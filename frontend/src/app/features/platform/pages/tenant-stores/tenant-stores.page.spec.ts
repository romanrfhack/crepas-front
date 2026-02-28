import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap } from '@angular/router';
import { ActivatedRoute, Router } from '@angular/router';
import { PlatformStoresApiService } from '../../services/platform-stores-api.service';
import { TenantStoresPage } from './tenant-stores.page';

describe('TenantStoresPage', () => {
  let fixture: ComponentFixture<TenantStoresPage>;
  const getTenantStores = vi.fn();
  const updateTenantDefaultStore = vi.fn();
  const navigate = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    getTenantStores.mockResolvedValue([
      {
        id: 'store-1',
        tenantId: 'tenant-1',
        name: 'Centro',
        isActive: true,
        isDefaultStore: true,
        hasAdminStore: true,
        adminStoreUserCount: 1,
        totalUsersInStore: 5,
        timeZoneId: 'UTC',
        createdAtUtc: '2026-01-01',
        updatedAtUtc: '2026-01-01',
      },
      {
        id: 'store-2',
        tenantId: 'tenant-1',
        name: 'Norte',
        isActive: true,
        isDefaultStore: false,
        hasAdminStore: false,
        adminStoreUserCount: 0,
        totalUsersInStore: 1,
        timeZoneId: 'UTC',
        createdAtUtc: '2026-01-01',
        updatedAtUtc: '2026-01-01',
      },
    ]);
    updateTenantDefaultStore.mockResolvedValue(undefined);
    navigate.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [TenantStoresPage],
      providers: [
        {
          provide: PlatformStoresApiService,
          useValue: { getTenantStores, updateTenantDefaultStore },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ tenantId: 'tenant-1' }),
              queryParamMap: convertToParamMap({}),
            },
          },
        },
        { provide: Router, useValue: { navigate } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TenantStoresPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders default/admin badges and quick actions per row', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('[data-testid="platform-tenant-stores-default-store-1"]')?.textContent).toContain(
      'Principal',
    );
    expect(host.querySelector('[data-testid="platform-tenant-stores-has-admin-store-2"]')?.textContent).toContain(
      'Sin AdminStore',
    );
    expect(
      host.querySelector('[data-testid="platform-tenant-stores-create-adminstore-store-2"]'),
    ).not.toBeNull();
    expect(host.querySelector('[data-testid="platform-tenant-stores-view-details-store-2"]')).not.toBeNull();
  });

  it('calls set default endpoint and reloads list', async () => {
    await fixture.componentInstance.setAsDefault('store-2');

    expect(updateTenantDefaultStore).toHaveBeenCalledWith('tenant-1', { defaultStoreId: 'store-2' });
    expect(getTenantStores).toHaveBeenCalledTimes(2);
  });

  it('navigates to contextual user creation when store has no AdminStore', () => {
    fixture.componentInstance.createAdminStore(fixture.componentInstance.stores()[1]!);

    expect(navigate).toHaveBeenCalledWith(['/app/admin/users'], {
      queryParams: {
        tenantId: 'tenant-1',
        storeId: 'store-2',
        intent: 'create-user',
        suggestedRole: 'AdminStore',
      },
    });
  });

  it('navigates to details from quick action', () => {
    fixture.componentInstance.openDetails('store-2');

    expect(navigate).toHaveBeenCalledWith(['/app/platform/stores', 'store-2']);
  });

  it('maps backend problem details errors consistently', async () => {
    updateTenantDefaultStore.mockRejectedValueOnce(
      new HttpErrorResponse({
        status: 409,
        error: { title: 'Conflict', errors: { defaultStoreId: ['Store does not belong to tenant.'] } },
      }),
    );

    await fixture.componentInstance.setAsDefault('store-2');

    expect(fixture.componentInstance.error()).toContain('Store does not belong to tenant.');
  });
});
