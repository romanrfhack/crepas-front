import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PosCatalogApiService } from '../../services/pos-catalog-api.service';
import { PosAdminCatalogOverridesApiService } from '../../services/pos-admin-catalog-overrides-api.service';
import { OverridesPage } from './overrides.page';

describe('OverridesPage', () => {
  let fixture: ComponentFixture<OverridesPage>;
  let upsertCalls: Array<{ storeId: string; itemType: string; itemId: string; state: 'Enabled' | 'Disabled' }>;
  let deleteCalls: Array<{ storeId: string; itemType: string; itemId: string }>;

  beforeEach(async () => {
    upsertCalls = [];
    deleteCalls = [];

    await TestBed.configureTestingModule({
      imports: [OverridesPage],
      providers: [
        {
          provide: PosCatalogApiService,
          useValue: {
            getProducts: async () => [{ id: 'product-1', name: 'Latte', externalCode: 'LAT-1' }],
            getExtras: async () => [{ id: 'extra-1', name: 'Shot' }],
            getOptionSets: async () => [{ id: 'set-1', name: 'Leches' }],
            getOptionItems: async () => [{ id: 'opt-1', optionSetId: 'set-1', name: 'Avena', isActive: true, isAvailable: true, sortOrder: 1 }],
          },
        },
        {
          provide: PosAdminCatalogOverridesApiService,
          useValue: {
            listOverrides: async () => [
              { storeId: 'store-1', itemType: 'Product', itemId: 'product-1', state: 'Disabled', updatedAtUtc: '2026-01-01T00:00:00Z' },
            ],
            upsertOverride: async (payload: { storeId: string; itemType: string; itemId: string; state: 'Enabled' | 'Disabled' }) => {
              upsertCalls.push(payload);
              return payload;
            },
            deleteOverride: async (storeId: string, itemType: string, itemId: string) => {
              deleteCalls.push({ storeId, itemType, itemId });
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OverridesPage);
    fixture.componentInstance.storeIdControl.setValue('store-1');
    await fixture.componentInstance.loadRows();
    fixture.detectChanges();
  });

  it('renders override state from backend list', () => {
    const productRow = fixture.componentInstance.rows().find((row) => row.itemType === 'Product');
    const extraRow = fixture.componentInstance.rows().find((row) => row.itemType === 'Extra');

    expect(productRow?.state).toBe('Disabled');
    expect(extraRow?.state).toBe('None');
  });

  it('sends enable/disable/clear actions with selected store', async () => {
    const productRow = fixture.componentInstance.rows().find((row) => row.itemType === 'Product')!;

    await fixture.componentInstance.setState(productRow, 'Enabled');
    await fixture.componentInstance.setState(productRow, 'Disabled');
    await fixture.componentInstance.clearOverride(productRow);

    expect(upsertCalls).toEqual([
      { storeId: 'store-1', itemType: 'Product', itemId: 'product-1', state: 'Enabled' },
      { storeId: 'store-1', itemType: 'Product', itemId: 'product-1', state: 'Disabled' },
    ]);
    expect(deleteCalls).toEqual([{ storeId: 'store-1', itemType: 'Product', itemId: 'product-1' }]);
  });

  it('rolls back visual state on save error', async () => {
    const service = TestBed.inject(PosAdminCatalogOverridesApiService) as unknown as {
      upsertOverride: () => Promise<unknown>;
    };
    service.upsertOverride = async () => {
      throw new HttpErrorResponse({ status: 500 });
    };

    const productRow = fixture.componentInstance.rows().find((row) => row.itemType === 'Product')!;
    await fixture.componentInstance.setState(productRow, 'Enabled');

    const updated = fixture.componentInstance.rows().find((row) => row.itemType === 'Product');
    expect(updated?.state).toBe('Disabled');
    expect(fixture.componentInstance.rowErrors()['Product-product-1']).toContain('store override');
  });
});
