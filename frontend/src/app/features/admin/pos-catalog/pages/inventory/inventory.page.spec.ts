import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '../../../../auth/services/auth.service';
import { PosCatalogSnapshotService } from '../../../../pos/services/pos-catalog-snapshot.service';
import { StoreContextService } from '../../../../pos/services/store-context.service';
import { PlatformTenantContextService } from '../../../../platform/services/platform-tenant-context.service';
import { PosInventoryAdminApiService } from '../../services/pos-inventory-admin-api.service';
import { InventoryPage } from './inventory.page';

describe('InventoryPage', () => {
  let fixture: ComponentFixture<InventoryPage>;
  let listCalls: Array<{ storeId: string; search?: string; onlyWithStock?: boolean }>;
  let upsertCalls: Array<{ storeId: string; productId: string; onHand: number }>;
  let settingsCalls: Array<{ showOnlyInStock: boolean }>;

  beforeEach(async () => {
    listCalls = [];
    upsertCalls = [];
    settingsCalls = [];

    await TestBed.configureTestingModule({
      imports: [InventoryPage],
      providers: [
        {
          provide: PosInventoryAdminApiService,
          useValue: {
            listLegacyInventory: async (storeId: string, search?: string, onlyWithStock?: boolean) => {
              listCalls.push({ storeId, search, onlyWithStock });
              return [
                {
                  storeId,
                  productId: 'product-1',
                  productName: 'Latte',
                  productSku: 'LAT-1',
                  onHand: 4,
                  reserved: 0,
                  updatedAtUtc: '2026-01-01T00:00:00Z',
                  hasInventoryRow: true,
                },
                {
                  storeId,
                  productId: 'product-2',
                  productName: 'Descafeinado',
                  productSku: 'DEC-1',
                  onHand: 0,
                  reserved: 0,
                  updatedAtUtc: null,
                  hasInventoryRow: false,
                },
              ];
            },
            upsertLegacyInventory: async (payload: { storeId: string; productId: string; onHand: number }) => {
              upsertCalls.push(payload);
              return {
                ...payload,
                productName: 'Latte',
                productSku: 'LAT-1',
                reserved: 0,
                updatedAtUtc: '2026-01-01T00:00:00Z',
                hasInventoryRow: true,
              };
            },
            updateInventorySettings: async (payload: { showOnlyInStock: boolean }) => {
              settingsCalls.push(payload);
              return payload;
            },
          },
        },
        { provide: StoreContextService, useValue: { getActiveStoreId: () => 'store-1' } },
        { provide: AuthService, useValue: { hasRole: () => false } },
        { provide: PlatformTenantContextService, useValue: { getSelectedTenantId: () => 'tenant-1' } },
        { provide: PosCatalogSnapshotService, useValue: { invalidate: () => undefined } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InventoryPage);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('loads inventory on init and refreshes with search', async () => {
    expect(listCalls[0]).toEqual({ storeId: 'store-1', search: '', onlyWithStock: undefined });

    fixture.componentInstance.searchControl.setValue('mocha');
    await fixture.componentInstance.loadInventory();

    expect(listCalls.at(-1)).toEqual({ storeId: 'store-1', search: 'mocha', onlyWithStock: undefined });
  });

  it('edits onHand and saves row', async () => {
    fixture.componentInstance.updateOnHand('product-1', {
      target: { value: '8' },
    } as unknown as Event);

    await fixture.componentInstance.saveRow(fixture.componentInstance.items()[0]!);

    expect(upsertCalls[0]).toEqual({ storeId: 'store-1', productId: 'product-1', onHand: 8 });
  });

  it('saves showOnlyInStock settings', async () => {
    fixture.componentInstance.showOnlyInStockControl.setValue(true);

    await fixture.componentInstance.saveSettings();

    expect(settingsCalls[0]).toEqual({ showOnlyInStock: true });
  });



  it('filters rows locally when only stock toggle is enabled', async () => {
    expect(fixture.componentInstance.visibleItems().map((item) => item.productId)).toEqual(['product-1', 'product-2']);

    fixture.componentInstance.onlyWithStockFilterControl.setValue(true);
    fixture.detectChanges();

    expect(fixture.componentInstance.visibleItems().map((item) => item.productId)).toEqual(['product-1']);
  });

  it('renders fallback dash when updatedAtUtc is null', () => {
    expect(fixture.componentInstance.formatUpdatedAt(null)).toBe('—');
  });

  it('shows tenant required message when backend returns 400', async () => {
    const api = TestBed.inject(PosInventoryAdminApiService) as unknown as {
      listLegacyInventory: () => Promise<unknown>;
    };
    api.listLegacyInventory = async () => {
      throw new HttpErrorResponse({
        status: 400,
        error: { detail: 'tenantId required for this endpoint in platform mode' },
      });
    };

    await fixture.componentInstance.loadInventory();

    expect(fixture.componentInstance.globalError()).toContain('Tenant requerido');
  });
});
