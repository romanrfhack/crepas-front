import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
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
        qtyDelta: -1,
        qtyAfter: 4,
        reason: 'ManualCount',
        movementKind: 'SaleConsumption',
        referenceType: 'Sale',
        referenceId: 'sale-1',
        createdAtUtc: '2026-05-01T00:00:00Z',
        performedByUserId: 'admin-1',
      },
      {
        id: 'adj-2',
        storeId: 'store-1',
        itemType: 'Product',
        itemId: 'product-1',
        itemName: 'Latte',
        qtyBefore: 4,
        qtyDelta: 1,
        qtyAfter: 5,
        reason: 'Correction',
        movementKind: 'VoidReversal',
        referenceType: 'SaleVoid',
        referenceId: 'void-1',
        createdAtUtc: '2026-05-01T00:05:00Z',
        performedByUserId: 'admin-1',
      },
      {
        id: 'adj-3',
        storeId: 'store-1',
        itemType: 'Product',
        itemId: 'product-1',
        itemName: 'Latte',
        qtyBefore: 5,
        qtyDelta: 0,
        qtyAfter: 5,
        reason: 'FutureReason',
        movementKind: 'FutureMovement',
        createdAtUtc: '2026-05-01T00:10:00Z',
        performedByUserId: 'admin-1',
      },
      {
        id: 'adj-4',
        storeId: 'store-1',
        itemType: 'Product',
        itemId: 'product-1',
        itemName: 'Latte',
        qtyBefore: 5,
        qtyDelta: 1,
        qtyAfter: 6,
        reason: 'Correction',
        reference: 'Legacy:manual-1',
        createdAtUtc: '2026-05-01T00:15:00Z',
        performedByUserId: 'admin-1',
      },
      {
        id: 'adj-5',
        storeId: 'store-1',
        itemType: 'Product',
        itemId: 'product-1',
        itemName: 'Latte',
        qtyBefore: 6,
        qtyDelta: -1,
        qtyAfter: 5,
        reason: 'Correction',
        createdAtUtc: '2026-05-01T00:20:00Z',
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
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
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

  it('el form de ajuste dispara submitAdjustment al enviar desde DOM', async () => {
    createAdjustment.mockResolvedValue({ id: 'adj-2' });
    fixture.componentInstance.adjustItemIdControl.setValue('product-1');
    fixture.componentInstance.adjustDeltaControl.setValue(2);
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('[data-testid="inventory-adjust-form"]') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(createAdjustment).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: 'store-1',
        itemType: 'Product',
        itemId: 'product-1',
        quantityDelta: 2,
        reason: 'Correction',
      }),
    );
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

  it('historial renderiza movementKind/referencias y fallback seguro', async () => {
    await fixture.componentInstance.loadHistory();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="inventory-history-movement-kind-adj-1"]')?.textContent,
    ).toContain('Consumo por venta');
    expect(
      fixture.nativeElement.querySelector('[data-testid="inventory-history-movement-kind-adj-2"]')?.textContent,
    ).toContain('Reversa por cancelación');
    expect(
      fixture.nativeElement.querySelector('[data-testid="inventory-history-movement-kind-adj-3"]')?.textContent,
    ).toContain('Otro (FutureMovement)');

    expect(fixture.nativeElement.querySelector('[data-testid="inventory-history-badge-sale-consumption"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="inventory-history-badge-void-reversal"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="inventory-history-badge-unknown"]')).not.toBeNull();

    expect(
      fixture.nativeElement.querySelector('[data-testid="inventory-history-reference-adj-1"]')?.textContent,
    ).toContain('Sale: sale-1');
    expect(
      fixture.nativeElement.querySelector('[data-testid="inventory-history-reference-adj-4"]')?.textContent,
    ).toContain('Legacy:manual-1');
    expect(
      fixture.nativeElement.querySelector('[data-testid="inventory-history-reference-adj-5"]')?.textContent,
    ).toContain('—');
  });

  it('historial renderiza filas y filtros disparan consulta', async () => {
    fixture.componentInstance.historyItemTypeControl.setValue('Product');
    fixture.componentInstance.historyItemIdControl.setValue('product-1');
    fixture.componentInstance.historyReasonControl.setValue('VoidReversal');

    await fixture.componentInstance.loadHistory();
    fixture.detectChanges();

    expect(listAdjustments).toHaveBeenLastCalledWith(
      expect.objectContaining({
        storeId: 'store-1',
        itemType: 'Product',
        itemId: 'product-1',
        reason: 'VoidReversal',
      }),
    );

    const row = fixture.nativeElement.querySelector('[data-testid="inventory-history-row-adj-2"]');
    expect(row).not.toBeNull();
  });

  it('renders inventory context badge when contextual filters are present', () => {
    fixture.componentInstance.contextStoreId.set('store-9');
    fixture.componentInstance.contextItemType.set('Product');
    fixture.componentInstance.contextSearch.set('latte');
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('[data-testid="inventory-context-badge"]');
    expect(badge?.textContent).toContain('Store: store-9 · Tipo: Product · Búsqueda: latte');
  });

});
