import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PlatformTenantContextService } from '../../services/platform-tenant-context.service';
import { PlatformTenantsApiService } from '../../services/platform-tenants-api.service';
import { PlatformVerticalsApiService } from '../../services/platform-verticals-api.service';
import { TenantsPage } from './tenants.page';

describe('TenantsPage', () => {
  let fixture: ComponentFixture<TenantsPage>;
  const createTenant = vi.fn();
  const updateTenant = vi.fn();
  const deleteTenant = vi.fn();
  const setSelectedTenantId = vi.fn();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TenantsPage],
      providers: [
        {
          provide: PlatformTenantsApiService,
          useValue: {
            listTenants: async () => [
              { id: 't1', verticalId: 'v1', name: 'Tenant One', slug: 'tenant-one', isActive: true, defaultStoreId: 's1', createdAtUtc: '2026-01-01', updatedAtUtc: '2026-01-01' },
            ],
            createTenant,
            updateTenant,
            deleteTenant,
          },
        },
        {
          provide: PlatformVerticalsApiService,
          useValue: {
            listVerticals: async () => [
              { id: 'v1', name: 'Retail', description: null, isActive: true, createdAtUtc: '2026-01-01', updatedAtUtc: '2026-01-01' },
            ],
          },
        },
        {
          provide: PlatformTenantContextService,
          useValue: {
            getSelectedTenantId: () => 't1',
            setSelectedTenantId,
          },
        },
      ],
    }).compileComponents();

    createTenant.mockResolvedValue({});
    updateTenant.mockResolvedValue({});
    deleteTenant.mockResolvedValue({});

    fixture = TestBed.createComponent(TenantsPage);
    await fixture.componentInstance.load();
    fixture.detectChanges();
  });

  it('renders table and active context indicator', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-testid="tenant-row-t1"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="tenant-context-active-t1"]')).toBeTruthy();
  });

  it('supports create/edit/delete and context selection', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const host = fixture.nativeElement as HTMLElement;

    host.querySelector('[data-testid="tenant-create-open"]')?.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    (host.querySelector('[data-testid="tenant-form-name"]') as HTMLInputElement).value = 'Tenant Two';
    host.querySelector('[data-testid="tenant-form-name"]')?.dispatchEvent(new Event('input'));
    (host.querySelector('[data-testid="tenant-form-slug"]') as HTMLInputElement).value = 'tenant-two';
    host.querySelector('[data-testid="tenant-form-slug"]')?.dispatchEvent(new Event('input'));
    (host.querySelector('[data-testid="tenant-form-vertical"]') as HTMLSelectElement).value = 'v1';
    host.querySelector('[data-testid="tenant-form-vertical"]')?.dispatchEvent(new Event('change'));

    const form = fixture.debugElement.query(By.css('form'));
    form.triggerEventHandler('submit', new Event('submit'));
    await fixture.whenStable();

    expect(createTenant).toHaveBeenCalled();

    host.querySelector('[data-testid="tenant-edit-t1"]')?.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    fixture.debugElement.query(By.css('form')).triggerEventHandler('submit', new Event('submit'));
    await fixture.whenStable();
    expect(updateTenant).toHaveBeenCalledWith('t1', { verticalId: 'v1', name: 'Tenant One', slug: 'tenant-one' });

    host.querySelector('[data-testid="tenant-set-context-t1"]')?.dispatchEvent(new Event('click'));
    expect(setSelectedTenantId).toHaveBeenCalledWith('t1');

    host.querySelector('[data-testid="tenant-delete-t1"]')?.dispatchEvent(new Event('click'));
    await fixture.whenStable();
    expect(deleteTenant).toHaveBeenCalledWith('t1');
  });
});
