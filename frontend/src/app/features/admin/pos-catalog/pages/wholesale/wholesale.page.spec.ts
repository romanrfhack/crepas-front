import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PosCatalogApiService } from '../../services/pos-catalog-api.service';
import { WholesalePage } from './wholesale.page';

describe('WholesalePage', () => {
  let fixture: ComponentFixture<WholesalePage>;
  let upsertPayload: unknown = null;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WholesalePage],
      providers: [
        {
          provide: PosCatalogApiService,
          useValue: {
            getTenantWholesalePolicy: async () => ({
              isEnabled: true,
              name: 'Policy',
              tiers: [{ minQty: 10, discountType: 'Percent', discountValue: 10 }],
            }),
            upsertTenantWholesalePolicy: async (payload: unknown) => {
              upsertPayload = payload;
              return payload;
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WholesalePage);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('loads tenant wholesale policy', () => {
    expect(fixture.componentInstance.form.controls.isEnabled.value).toBe(true);
    expect(fixture.componentInstance.tiers.length).toBe(1);
  });

  it('saves policy with sorted tiers', async () => {
    fixture.componentInstance.tiers.clear();
    fixture.componentInstance.addTier();
    fixture.componentInstance.addTier();
    fixture.componentInstance.tiers.at(0).patchValue({ minQty: 20, discountType: 'Percent', discountValue: 20 });
    fixture.componentInstance.tiers.at(1).patchValue({ minQty: 10, discountType: 'Percent', discountValue: 10 });

    await fixture.componentInstance.onSave(new Event('submit'));

    expect((upsertPayload as { tiers: Array<{ minQty: number }> }).tiers[0]?.minQty).toBe(10);
  });

  it('validates percent range', async () => {
    fixture.componentInstance.tiers.clear();
    fixture.componentInstance.addTier();
    fixture.componentInstance.tiers.at(0).patchValue({ minQty: 10, discountType: 'Percent', discountValue: 100 });

    await fixture.componentInstance.onSave(new Event('submit'));

    expect(fixture.componentInstance.errorMessage()).toContain('>0 y <100');
  });
});
