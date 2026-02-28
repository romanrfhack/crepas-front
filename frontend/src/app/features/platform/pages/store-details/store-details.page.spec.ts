import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { PlatformStoresApiService } from '../../services/platform-stores-api.service';
import { StoreDetailsPage } from './store-details.page';

describe('StoreDetailsPage', () => {
  let fixture: ComponentFixture<StoreDetailsPage>;
  const getStoreDetails = vi.fn();
  const updateStore = vi.fn();
  const updateTenantDefaultStore = vi.fn();

  beforeEach(async () => {
    getStoreDetails.mockResolvedValue({
      id: 'store-1',
      tenantId: 'tenant-1',
      tenantName: 'Tenant Uno',
      name: 'Centro',
      isActive: true,
      isDefaultStore: false,
      hasAdminStore: false,
      adminStoreUserCount: 0,
      totalUsersInStore: 2,
      timeZoneId: 'UTC',
      createdAtUtc: '2026-01-01',
      updatedAtUtc: '2026-01-01',
    });
    updateStore.mockImplementation(async (_id, payload) => ({
      id: 'store-1',
      tenantId: 'tenant-1',
      tenantName: 'Tenant Uno',
      name: payload.name,
      isActive: payload.isActive,
      isDefaultStore: false,
      hasAdminStore: false,
      adminStoreUserCount: 0,
      totalUsersInStore: 2,
      timeZoneId: payload.timeZoneId,
      createdAtUtc: '2026-01-01',
      updatedAtUtc: '2026-01-02',
    }));
    updateTenantDefaultStore.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [StoreDetailsPage],
      providers: [
        {
          provide: PlatformStoresApiService,
          useValue: { getStoreDetails, updateStore, updateTenantDefaultStore },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ storeId: 'store-1' }) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StoreDetailsPage);
    await fixture.componentInstance.ngOnInit();
    fixture.detectChanges();
  });

  it('submits store edition to backend endpoint contract', async () => {
    fixture.componentInstance.openEdit();
    fixture.componentInstance.nameControl.setValue('Centro Actualizado');
    fixture.componentInstance.timeZoneControl.setValue('America/Mexico_City');
    await fixture.componentInstance.submit(new Event('submit'));

    expect(updateStore).toHaveBeenCalledWith('store-1', {
      name: 'Centro Actualizado',
      timeZoneId: 'America/Mexico_City',
      isActive: true,
    });
  });

  it('calls default store endpoint from details page', async () => {
    await fixture.componentInstance.setAsDefault();

    expect(updateTenantDefaultStore).toHaveBeenCalledWith('tenant-1', { defaultStoreId: 'store-1' });
  });

  it('maps backend 400/404/409 problem details to stable error message', async () => {
    updateStore.mockRejectedValueOnce(
      new HttpErrorResponse({
        status: 400,
        error: { detail: 'TimeZoneId is required.' },
      }),
    );

    fixture.componentInstance.openEdit();
    await fixture.componentInstance.submit(new Event('submit'));

    expect(fixture.componentInstance.error()).toContain('TimeZoneId is required.');
  });
});
