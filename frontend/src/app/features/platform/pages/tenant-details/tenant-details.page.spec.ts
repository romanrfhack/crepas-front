import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { PlatformTenantsApiService } from '../../services/platform-tenants-api.service';
import { PlatformVerticalsApiService } from '../../services/platform-verticals-api.service';
import { TenantDetailsPage } from './tenant-details.page';

describe('TenantDetailsPage', () => {
  let fixture: ComponentFixture<TenantDetailsPage>;
  const updateTenantDetails = vi.fn();
  const navigate = vi.fn();

  const tenant = {
    id: 'tenant-1',
    name: 'Tenant One',
    slug: 'tenant-one',
    verticalId: 'vertical-1',
    verticalName: 'Retail',
    isActive: true,
    defaultStoreId: 'store-1',
    defaultStoreName: 'Store One',
    storeCount: 8,
    activeStoreCount: 7,
    hasCatalogTemplate: true,
    catalogTemplateId: 'template-1',
    catalogTemplateName: 'Plantilla Retail',
    usersCount: 10,
    usersWithoutStoreAssignmentCount: 2,
    storesWithoutAdminStoreCount: 1,
    createdAtUtc: '2026-01-01T00:00:00Z',
    updatedAtUtc: '2026-01-02T00:00:00Z',
  };

  beforeEach(async () => {
    navigate.mockReset();
    updateTenantDetails.mockReset();

    await TestBed.configureTestingModule({
      imports: [TenantDetailsPage],
      providers: [
        {
          provide: PlatformTenantsApiService,
          useValue: {
            getTenantDetails: async () => tenant,
            updateTenantDetails,
          },
        },
        {
          provide: PlatformVerticalsApiService,
          useValue: {
            listVerticals: async () => [
              {
                id: 'vertical-1',
                name: 'Retail',
                description: null,
                isActive: true,
                createdAtUtc: '2026-01-01',
                updatedAtUtc: '2026-01-01',
              },
            ],
          },
        },
        { provide: Router, useValue: { navigate } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ tenantId: 'tenant-1' }) } },
        },
      ],
    }).compileComponents();

    updateTenantDetails.mockResolvedValue({
      ...tenant,
      name: 'Tenant Updated',
      slug: 'tenant-updated',
    });
    fixture = TestBed.createComponent(TenantDetailsPage);
    await fixture.componentInstance.load();
    fixture.detectChanges();
  });

  it('renders friendly fields and metrics', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(
      host.querySelector('[data-testid="platform-tenant-details-name"]')?.textContent,
    ).toContain('Tenant One');
    expect(
      host.querySelector('[data-testid="platform-tenant-details-slug"]')?.textContent,
    ).toContain('tenant-one');
    expect(
      host.querySelector('[data-testid="platform-tenant-details-vertical"]')?.textContent,
    ).toContain('Retail');
    expect(
      host.querySelector('[data-testid="platform-tenant-details-default-store"]')?.textContent,
    ).toContain('Store One');
    expect(
      host.querySelector('[data-testid="platform-tenant-details-template"]')?.textContent,
    ).toContain('Plantilla Retail');
    expect(
      host.querySelector('[data-testid="platform-tenant-details-metric-store-count"]')?.textContent,
    ).toContain('8');
    expect(
      host.querySelector('[data-testid="platform-tenant-details-metric-users-count"]')?.textContent,
    ).toContain('10');
  });

  it('navigates through quick actions', () => {
    const host = fixture.nativeElement as HTMLElement;
    host
      .querySelector('[data-testid="platform-tenant-details-action-stores"]')
      ?.dispatchEvent(new Event('click'));
    host
      .querySelector('[data-testid="platform-tenant-details-action-users"]')
      ?.dispatchEvent(new Event('click'));
    host
      .querySelector('[data-testid="platform-tenant-details-action-dashboard"]')
      ?.dispatchEvent(new Event('click'));
    host
      .querySelector('[data-testid="platform-tenant-details-action-reports"]')
      ?.dispatchEvent(new Event('click'));
    host
      .querySelector('[data-testid="platform-tenant-details-action-inventory"]')
      ?.dispatchEvent(new Event('click'));

    expect(navigate).toHaveBeenCalledWith(['/app/platform/tenants', 'tenant-1', 'stores']);
    expect(navigate).toHaveBeenCalledWith(['/app/admin/users'], {
      queryParams: { tenantId: 'tenant-1' },
    });
    expect(navigate).toHaveBeenCalledWith(['/app/platform/dashboard']);
    expect(navigate).toHaveBeenCalledWith(['/app/platform/dashboard'], {
      queryParams: { tenantId: 'tenant-1' },
    });
    expect(navigate).toHaveBeenCalledWith(['/app/admin/pos/inventory'], {
      queryParams: { tenantId: 'tenant-1', storeId: 'store-1' },
    });
  });

  it('shows highlighted CTA to review stores without admin', () => {
    const host = fixture.nativeElement as HTMLElement;
    const cta = host.querySelector(
      '[data-testid="platform-tenant-details-action-review-stores-without-admin"]',
    );

    expect(cta).toBeTruthy();

    cta?.dispatchEvent(new Event('click'));

    expect(navigate).toHaveBeenCalledWith(['/app/platform/tenants', 'tenant-1', 'stores'], {
      queryParams: { withoutAdminStore: 'true' },
    });
  });

  it('prefills and submits edit form', async () => {
    const host = fixture.nativeElement as HTMLElement;
    host
      .querySelector('[data-testid="platform-tenant-details-action-edit"]')
      ?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    const nameInput = host.querySelector(
      '[data-testid="platform-tenant-edit-name"]',
    ) as HTMLInputElement;
    const slugInput = host.querySelector(
      '[data-testid="platform-tenant-edit-slug"]',
    ) as HTMLInputElement;
    expect(nameInput.value).toBe('Tenant One');
    expect(slugInput.value).toBe('tenant-one');

    nameInput.value = 'Tenant Updated';
    nameInput.dispatchEvent(new Event('input'));
    slugInput.value = 'tenant-updated';
    slugInput.dispatchEvent(new Event('input'));

    host
      .querySelector('[data-testid="platform-tenant-edit-form"]')
      ?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(updateTenantDetails).toHaveBeenCalledWith('tenant-1', {
      name: 'Tenant Updated',
      slug: 'tenant-updated',
      verticalId: 'vertical-1',
      isActive: true,
    });
    expect(host.querySelector('[data-testid="platform-tenant-edit-success"]')).toBeTruthy();
  });

  it('renders backend errors (400/404/409) in stable container', async () => {
    updateTenantDetails.mockRejectedValueOnce({
      error: { title: 'ValidationError', errors: { slug: ['Duplicado'] } },
    });

    const host = fixture.nativeElement as HTMLElement;
    host
      .querySelector('[data-testid="platform-tenant-details-action-edit"]')
      ?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    host
      .querySelector('[data-testid="platform-tenant-edit-form"]')
      ?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(host.querySelector('[data-testid="platform-tenant-edit-error"]')?.textContent).toContain(
      'Duplicado',
    );
  });
});
