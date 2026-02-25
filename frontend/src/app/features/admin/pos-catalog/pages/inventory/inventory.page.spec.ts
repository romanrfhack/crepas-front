import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PosCatalogApiService } from '../../services/pos-catalog-api.service';
import { PosInventoryAdjustmentsApiService } from '../../services/pos-inventory-adjustments-api.service';
import { PosInventoryAdminApiService } from '../../services/pos-inventory-admin-api.service';
import { InventoryPage } from './inventory.page';
import { AuthService } from '../../../../auth/services/auth.service';
import { PlatformTenantContextService } from '../../../../platform/services/platform-tenant-context.service';

describe('InventoryPage', () => {
  let fixture: ComponentFixture<InventoryPage>;
  const listAdjustments = vi.fn();
  const createAdjustment = vi.fn();

  beforeEach(async () => {
    listAdjustments.mockResolvedValue([
      {
        id: 'adj-1',
        storeId: 'store-1',
        itemType: 'Product',
        itemId: 'product-1',
        itemName: 'Latte',
        qtyBefore: 5,
        qtyDelta: 2,
        qtyAfter: 7,
        reason: 'Purchase',
        createdAtUtc: '2026-05-01T00:00:00Z',
        performedByUserId: 'admin-1',
      },
    ]);

    await TestBed.configureTestingModule({
      imports: [InventoryPage],
      providers: [
        {
          provide: PosInventoryAdminApiService,
          useValue: {
            listInventory: vi.fn().mockResolvedValue([
              {
                storeId: 'store-1',
                itemType: 'Product',
                itemId: 'product-1',
                itemName: 'Latte',
                onHandQty: 4,
                updatedAtUtc: '2026-01-01T00:00:00Z',
                isInventoryTracked: true,
              },
            ]),
          },
        },
        {
          provide: PosCatalogApiService,
          useValue: {
            getProducts: vi.fn().mockResolvedValue([{ id: 'product-1', name: 'Latte', externalCode: 'LAT-1' }]),
            getExtras: vi.fn().mockResolvedValue([{ id: 'extra-1', name: 'Shot' }]),
          },
        },
        {
          provide: PosInventoryAdjustmentsApiService,
          useValue: { listAdjustments, createAdjustment },
        },
        { provide: AuthService, useValue: { hasRole: () => false } },
        { provide: PlatformTenantContextService, useValue: { getSelectedTenantId: () => null } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InventoryPage);
    fixture.componentInstance.storeIdControl.setValue('store-1');
    fixture.componentInstance.adjustStoreIdControl.setValue('store-1');
    fixture.componentInstance.historyStoreIdControl.setValue('store-1');
    await fixture.componentInstance.loadInventory();
    await fixture.componentInstance.loadHistory();
    fixture.detectChanges();
  });

  it('submit ajuste muestra success por data-testid estable', async () => {
    createAdjustment.mockResolvedValue({ id: 'adj-2' });
    fixture.componentInstance.adjustItemIdControl.setValue('product-1');
    fixture.componentInstance.adjustDeltaControl.setValue(3);

    await fixture.componentInstance.submitAdjustment();
    fixture.detectChanges();

    const success = fixture.nativeElement.querySelector('[data-testid="inventory-adjust-success"]');
    expect(success?.textContent).toContain('AdjustmentCreated');
  });

  it('submit ajuste muestra error reason code en 409', async () => {
    createAdjustment.mockRejectedValue(
      new HttpErrorResponse({ status: 409, error: { reason: 'NegativeStockNotAllowed' } }),
    );
    fixture.componentInstance.adjustItemIdControl.setValue('product-1');
    fixture.componentInstance.adjustDeltaControl.setValue(-99);

    await fixture.componentInstance.submitAdjustment();
    fixture.detectChanges();

    const error = fixture.nativeElement.querySelector('[data-testid="inventory-adjust-error"]');
    expect(error?.textContent).toContain('NegativeStockNotAllowed');
  });

  it('historial renderiza filas y filtros disparan consulta', async () => {
    fixture.componentInstance.historyItemTypeControl.setValue('Product');
    fixture.componentInstance.historyItemIdControl.setValue('product-1');

    await fixture.componentInstance.loadHistory();
    fixture.detectChanges();

    expect(listAdjustments).toHaveBeenLastCalledWith(
      expect.objectContaining({ storeId: 'store-1', itemType: 'Product', itemId: 'product-1' }),
    );

    const row = fixture.nativeElement.querySelector('[data-testid="inventory-history-row-adj-1"]');
    expect(row).not.toBeNull();
  });
});
