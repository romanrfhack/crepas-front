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
  const createInventoryAdjustmentV2 = vi.fn();
  const listInventoryMovementsV2 = vi.fn();
  const listInventoryV2 = vi.fn();
  const createInventoryBatchAdjustmentV2 = vi.fn();
  const validateInventoryBatchAdjustmentV2 = vi.fn();
  const exportInventoryBalancesV2 = vi.fn();
  const getCategories = vi.fn();

  beforeEach(async () => {
    listAdjustments.mockReset();
    createAdjustment.mockReset();
    createInventoryAdjustmentV2.mockReset();
    listInventoryMovementsV2.mockReset();
    listInventoryV2.mockReset();
    createInventoryBatchAdjustmentV2.mockReset();
    validateInventoryBatchAdjustmentV2.mockReset();
    exportInventoryBalancesV2.mockReset();
    getCategories.mockReset();

    listInventoryV2.mockResolvedValue({
      items: [
        {
          itemType: 'Product',
          itemId: 'product-1',
          name: 'Latte',
          sku: 'LAT-1',
          categoryName: 'Bebidas',
          isInventoryTracked: true,
          onHandQty: 1.25,
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 25,
    });
    getCategories.mockResolvedValue([
      { id: 'cat-1', name: 'Bebidas', sortOrder: 1, isActive: true },
    ]);
    createInventoryBatchAdjustmentV2.mockResolvedValue({
      batchClientOperationId: 'batch-1',
      totals: { appliedCount: 1, failedCount: 0 },
      lines: [],
    });
    validateInventoryBatchAdjustmentV2.mockResolvedValue({
      storeId: 'store-1',
      totalLines: 1,
      validCount: 1,
      invalidCount: 0,
      lines: [
        {
          lineNo: 1,
          itemType: 'Product',
          externalCode: 'LAT-1',
          status: 'Valid',
          qtyBefore: 4,
          qtyAfter: 2,
          deltaQtyNormalized: -2,
        },
      ],
    });

    // default apply result
    createInventoryBatchAdjustmentV2.mockResolvedValue({
      batchClientOperationId: 'batch-1',
      totals: { appliedCount: 1, failedCount: 0 },
      lines: [],
    });
    exportInventoryBalancesV2.mockResolvedValue(new Blob(['csv']));

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
            listInventoryV2,
            createInventoryAdjustmentV2,
            listInventoryMovementsV2,
            createInventoryBatchAdjustmentV2,
            validateInventoryBatchAdjustmentV2,
            exportInventoryBalancesV2,
            upsertInventory: vi.fn().mockResolvedValue({
              storeId: 'store-1',
              itemType: 'Product',
              itemId: 'product-1',
              onHandQty: 1.25,
              updatedAtUtc: '2026-01-01T00:00:00Z',
              isInventoryTracked: true,
            }),
          },
        },
        {
          provide: PosCatalogApiService,
          useValue: {
            getProducts: vi
              .fn()
              .mockResolvedValue([{ id: 'product-1', name: 'Latte', externalCode: 'LAT-1' }]),
            getExtras: vi.fn().mockResolvedValue([{ id: 'extra-1', name: 'Shot' }]),
            getCategories,
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

    const form = fixture.nativeElement.querySelector(
      '[data-testid="inventory-adjust-form"]',
    ) as HTMLFormElement;
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
    expect(error?.textContent).toContain('NEGATIVE_STOCK');
  });

  it('historial renderiza movementKind/referencias y fallback seguro', async () => {
    await fixture.componentInstance.loadHistory();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="inventory-history-movement-kind-adj-1"]')
        ?.textContent,
    ).toContain('Consumo por venta');
    expect(
      fixture.nativeElement.querySelector('[data-testid="inventory-history-movement-kind-adj-2"]')
        ?.textContent,
    ).toContain('Reversa por cancelación');
    expect(
      fixture.nativeElement.querySelector('[data-testid="inventory-history-movement-kind-adj-3"]')
        ?.textContent,
    ).toContain('Otro (FutureMovement)');

    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="inventory-history-badge-sale-consumption"]',
      ),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="inventory-history-badge-void-reversal"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="inventory-history-badge-unknown"]'),
    ).not.toBeNull();

    expect(
      fixture.nativeElement.querySelector('[data-testid="inventory-history-reference-adj-1"]')
        ?.textContent,
    ).toContain('Sale: sale-1');
    expect(
      fixture.nativeElement.querySelector('[data-testid="inventory-history-reference-adj-4"]')
        ?.textContent,
    ).toContain('Legacy:manual-1');
    expect(
      fixture.nativeElement.querySelector('[data-testid="inventory-history-reference-adj-5"]')
        ?.textContent,
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

  it('saveInventoryRow conserva decimales en payload', async () => {
    const api = TestBed.inject(PosInventoryAdminApiService);
    const upsertSpy = vi.spyOn(api, 'upsertInventory').mockResolvedValue({
      storeId: 'store-1',
      itemType: 'Product',
      itemId: 'product-1',
      onHandQty: 1.25,
      updatedAtUtc: '2026-01-01T00:00:00Z',
    });

    const row = fixture.componentInstance.items()[0]!;
    fixture.componentInstance.setDraftStock(row, '1.250');
    await fixture.componentInstance.saveInventoryRow(row);

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        onHandQty: 1.25,
      }),
    );
  });

  it('formatQty renderiza 3 decimales', () => {
    expect(fixture.componentInstance.formatQty(1.25)).toBe('1.250');
  });

  it('inventory v2 renderiza tabla y permite retry en error', async () => {
    const component = fixture.componentInstance as InventoryPage & { inventoryV2Enabled: boolean };
    component.inventoryV2Enabled = true;
    const api = TestBed.inject(PosInventoryAdminApiService);
    const listInventoryV2Spy = vi.spyOn(api, 'listInventoryV2');
    listInventoryV2Spy.mockRejectedValueOnce(new Error('boom'));

    await fixture.componentInstance.loadInventoryV2();
    fixture.detectChanges();
    expect(listInventoryV2Spy).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.inventoryV2Error()).toContain(
      'No fue posible cargar inventario',
    );

    listInventoryV2Spy.mockResolvedValueOnce({
      items: [
        {
          itemType: 'Product',
          itemId: 'product-1',
          name: 'Latte',
          sku: 'LAT-1',
          categoryName: 'Bebidas',
          isInventoryTracked: true,
          onHandQty: 1.25,
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 10,
    });

    await fixture.componentInstance.loadInventoryV2();
    fixture.detectChanges();

    expect(fixture.componentInstance.inventoryV2Rows().length).toBe(1);
  });

  it('renders inventory context badge when contextual filters are present', () => {
    fixture.componentInstance.contextStoreId.set('store-9');
    fixture.componentInstance.contextItemType.set('Product');
    fixture.componentInstance.contextSearch.set('latte');
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('[data-testid="inventory-context-badge"]');
    expect(badge?.textContent).toContain('Store: store-9 · Tipo: Product · Búsqueda: latte');
  });

  it('abre Kardex con item correcto y permite retry', async () => {
    listInventoryMovementsV2.mockRejectedValueOnce(new Error('boom'));

    fixture.componentInstance.openMovementsDrawer({
      itemType: 'Product',
      itemId: 'product-1',
      name: 'Latte',
      sku: 'LAT-1',
      categoryName: 'Bebidas',
      isInventoryTracked: true,
      onHandQty: 1.25,
      balanceVersion: 'v-old',
    });
    await fixture.whenStable();

    expect(fixture.componentInstance.movementsDrawerOpen()).toBe(true);
    expect(listInventoryMovementsV2).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: 'store-1',
        itemType: 'Product',
        itemId: 'product-1',
        page: 1,
      }),
    );
    expect(fixture.componentInstance.movementError()).toContain('No fue posible cargar el kardex');

    listInventoryMovementsV2.mockResolvedValueOnce({
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 10,
    });
    await fixture.componentInstance.reloadMovementsDrawer();

    expect(listInventoryMovementsV2).toHaveBeenCalledTimes(2);
  });

  it('v2 ajuste delta envia quantity como number redondeado', async () => {
    createInventoryAdjustmentV2.mockResolvedValue({
      adjustmentId: 'adj-v2-1',
      storeId: 'store-1',
      itemType: 'Product',
      itemId: 'product-1',
      qtyBefore: 1.25,
      qtyAfter: 2.5,
      deltaApplied: 1.25,
      balanceVersion: 'v-new',
      createdAtUtc: '2026-01-01T00:00:00Z',
      reasonCode: 'Correction',
    });

    fixture.componentInstance.openAdjustmentDialog({
      itemType: 'Product',
      itemId: 'product-1',
      name: 'Latte',
      sku: 'LAT-1',
      categoryName: 'Bebidas',
      isInventoryTracked: true,
      onHandQty: 1.25,
      balanceVersion: 'v-old',
    });

    await fixture.componentInstance.submitInventoryV2Adjustment({
      operationType: 'Delta',
      quantity: 1.25,
      reasonCode: 'Correction',
      reference: null,
      note: null,
    });

    expect(createInventoryAdjustmentV2).toHaveBeenCalledWith(
      expect.objectContaining({
        operationType: 'Delta',
        quantityDelta: 1.25,
      }),
    );
    expect(typeof createInventoryAdjustmentV2.mock.calls.at(-1)?.[0]?.quantityDelta).toBe('number');
  });

  it('v2 ajuste set manda expectedVersion y operationType correcto', async () => {
    createInventoryAdjustmentV2.mockResolvedValue({
      adjustmentId: 'adj-v2-1',
      storeId: 'store-1',
      itemType: 'Product',
      itemId: 'product-1',
      qtyBefore: 1.25,
      qtyAfter: 3,
      deltaApplied: 1.75,
      balanceVersion: 'v-new',
      createdAtUtc: '2026-01-01T00:00:00Z',
      reasonCode: 'ManualCount',
    });
    fixture.componentInstance.openAdjustmentDialog({
      itemType: 'Product',
      itemId: 'product-1',
      name: 'Latte',
      sku: 'LAT-1',
      categoryName: 'Bebidas',
      isInventoryTracked: true,
      onHandQty: 1.25,
      balanceVersion: 'v-old',
    });

    await fixture.componentInstance.submitInventoryV2Adjustment({
      operationType: 'Set',
      quantity: 3,
      reasonCode: 'ManualCount',
      reference: null,
      note: null,
    });

    expect(createInventoryAdjustmentV2).toHaveBeenCalledWith(
      expect.objectContaining({
        operationType: 'Set',
        quantitySet: 3,
        expectedVersion: 'v-old',
      }),
    );
  });

  it('retry reusa mismo clientOperationId', async () => {
    createInventoryAdjustmentV2.mockRejectedValueOnce(new HttpErrorResponse({ status: 500 }));
    createInventoryAdjustmentV2.mockResolvedValueOnce({
      adjustmentId: 'adj-v2-2',
      storeId: 'store-1',
      itemType: 'Product',
      itemId: 'product-1',
      qtyBefore: 1.25,
      qtyAfter: 2.25,
      deltaApplied: 1,
      balanceVersion: 'v-2',
      createdAtUtc: '2026-01-01T00:00:00Z',
      reasonCode: 'Correction',
    });

    fixture.componentInstance.openAdjustmentDialog({
      itemType: 'Product',
      itemId: 'product-1',
      name: 'Latte',
      sku: 'LAT-1',
      categoryName: 'Bebidas',
      isInventoryTracked: true,
      onHandQty: 1.25,
      balanceVersion: 'v-old',
    });

    await fixture.componentInstance.submitInventoryV2Adjustment({
      operationType: 'Delta',
      quantity: 1,
      reasonCode: 'Correction',
      reference: null,
      note: null,
    });
    await fixture.componentInstance.retryLastInventoryV2Adjustment();

    const firstPayload = createInventoryAdjustmentV2.mock.calls[0][0];
    const secondPayload = createInventoryAdjustmentV2.mock.calls[1][0];
    expect(firstPayload.clientOperationId).toBe(secondPayload.clientOperationId);
  });

  it('mapea conflicto de concurrencia en ajuste v2', async () => {
    createInventoryAdjustmentV2.mockRejectedValue(
      new HttpErrorResponse({ status: 409, error: { reason: 'CONCURRENCY_CONFLICT' } }),
    );

    fixture.componentInstance.openAdjustmentDialog({
      itemType: 'Product',
      itemId: 'product-1',
      name: 'Latte',
      sku: 'LAT-1',
      categoryName: 'Bebidas',
      isInventoryTracked: true,
      onHandQty: 1.25,
      balanceVersion: 'v-old',
    });
    await fixture.componentInstance.submitInventoryV2Adjustment({
      operationType: 'Set',
      quantity: 2,
      reasonCode: 'ManualCount',
      reference: null,
      note: null,
    });

    expect(fixture.componentInstance.adjustErrorReason()).toBe('CONCURRENCY_CONFLICT');
  });

  it('carga categorías para filtro de negocio', async () => {
    await fixture.componentInstance['loadCatalogItems']();
    expect(getCategories).toHaveBeenCalled();
  });

  it('batch submit arma payload correcto desde selección', async () => {
    const page = fixture.componentInstance;
    page['inventoryFacade'].rows.set([
      {
        itemType: 'Product',
        itemId: 'product-1',
        name: 'Latte',
        sku: 'LAT-1',
        categoryName: 'Bebidas',
        isInventoryTracked: true,
        onHandQty: 1.25,
      },
    ]);
    page.batchDeltaControl.setValue(-1);
    page.batchReasonControl.setValue('Correction');
    page.toggleRowSelection(page.inventoryV2Rows()[0], true);

    await page.applyBatchAdjustmentFromSelection();

    expect(createInventoryBatchAdjustmentV2).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: 'store-1',
        reasonCode: 'Correction',
        items: [
          expect.objectContaining({
            itemType: 'Product',
            itemId: 'product-1',
            operationType: 'Delta',
            quantityDelta: -1,
          }),
        ],
      }),
    );
  });

  it('export dispara descarga con filtros actuales', async () => {
    const page = fixture.componentInstance;
    page['inventoryFacade'].updateStore('store-1');
    page['inventoryFacade'].updateSearch('latte');
    page['inventoryFacade'].updateTracked('true');
    await page.loadInventoryV2();

    await page.exportInventoryV2Csv();

    expect(exportInventoryBalancesV2).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: 'store-1', tracked: true }),
    );
  });

  it('al cargar CSV llama validate y muestra qtyBefore/qtyAfter', async () => {
    vi.useFakeTimers();
    const page = fixture.componentInstance;
    const csv =
      'storeId,itemType,externalCode,deltaQty,reasonCode,referenceId,note\nstore-1,Product,LAT-1,-2,Correction,ref-1,nota';
    const file = { text: () => Promise.resolve(csv) };
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: { item: () => file } });

    await page.onImportFileSelected({ target: input } as unknown as Event);
    vi.advanceTimersByTime(260);
    await Promise.resolve();

    expect(validateInventoryBatchAdjustmentV2).toHaveBeenCalled();
    expect(page.importPreviewRows()[0].qtyBefore).toBe(4);
    expect(page.importPreviewRows()[0].qtyAfter).toBe(2);
    vi.useRealTimers();
  });

  it('si validate falla muestra error y mantiene Apply deshabilitado', async () => {
    vi.useFakeTimers();
    const page = fixture.componentInstance;
    validateInventoryBatchAdjustmentV2.mockRejectedValueOnce(new Error('boom'));
    const csv =
      'storeId,itemType,externalCode,deltaQty,reasonCode,referenceId,note\nstore-1,Product,LAT-1,-2,Correction,ref-1,nota';
    const file = { text: () => Promise.resolve(csv) };
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: { item: () => file } });

    await page.onImportFileSelected({ target: input } as unknown as Event);
    vi.advanceTimersByTime(260);
    await Promise.resolve();

    expect(page.importValidateError()).toContain('No se pudo validar');
    expect(page.canApplyImport()).toBe(false);
    vi.useRealTimers();
  });

  it('import parsea CSV y permite preview', async () => {
    const page = fixture.componentInstance;
    const csv =
      'storeId,itemType,externalCode,deltaQty,reasonCode,referenceId,note\nstore-1,Product,LAT-1,-2,Correction,ref-1,nota';
    const file = { text: () => Promise.resolve(csv) };
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: { item: () => file } });

    await page.onImportFileSelected({ target: input } as unknown as Event);

    expect(page.importPreviewRows().length).toBe(1);
    expect(page.importPreviewRows()[0].externalCode).toBe('LAT-1');
    expect(page.importPreviewRows()[0].validationError).toBeNull();
  });

  it('filtro de resultados All/Applied/Failed actualiza filas visibles', () => {
    const page = fixture.componentInstance;
    page.batchResultRows.set([
      {
        lineNo: 1,
        itemType: 'Product',
        externalCode: 'LAT-1',
        itemId: '',
        deltaQty: -1,
        status: 'Applied',
        errorCode: '',
        message: '',
        qtyBefore: 2,
        qtyAfter: 1,
        deltaApplied: -1,
        adjustmentId: 'adj-1',
      },
      {
        lineNo: 2,
        itemType: 'Product',
        externalCode: 'UNK-1',
        itemId: '',
        deltaQty: -1,
        status: 'Failed',
        errorCode: 'UNKNOWN_ITEM',
        message: 'No existe',
        qtyBefore: null,
        qtyAfter: null,
        deltaApplied: null,
        adjustmentId: '',
      },
    ]);

    page.batchResultFilter.set('All');
    expect(page.filteredBatchResultRows().length).toBe(2);

    page.batchResultFilter.set('Applied');
    expect(page.filteredBatchResultRows().map((row) => row.status)).toEqual(['Applied']);

    page.batchResultFilter.set('Failed');
    expect(page.filteredBatchResultRows().map((row) => row.status)).toEqual(['Failed']);
  });

  it('preview solo inválidas cambia dataset mostrado', async () => {
    const page = fixture.componentInstance;
    const csv = `storeId,itemType,externalCode,deltaQty,reasonCode,referenceId,note
store-1,Product,LAT-1,-2,Correction,ref-1,nota
store-1,Product,,0,Correction,ref-2,nota`;
    const file = { text: () => Promise.resolve(csv) };
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: { item: () => file } });

    await page.onImportFileSelected({ target: input } as unknown as Event);

    expect(page.previewRowsToRender().length).toBe(2);
    page.showOnlyInvalidPreviewRows.set(true);
    expect(page.previewRowsToRender().length).toBe(1);
    expect(page.previewRowsToRender()[0].validationError).toBe('UNKNOWN_ITEM');
  });

  it('bloquea import si faltan columnas obligatorias', async () => {
    const page = fixture.componentInstance;
    const csv = `storeId,itemType,externalCode\nstore-1,Product,LAT-1`;
    const file = { text: () => Promise.resolve(csv) };
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: { item: () => file } });

    await page.onImportFileSelected({ target: input } as unknown as Event);

    expect(page.importColumnsErrorMessage()).toContain('Faltan columnas obligatorias');
    expect(page.canApplyImport()).toBe(false);
  });

  it('marca error explícito para coma decimal en deltaQty', async () => {
    const page = fixture.componentInstance;
    const csv = `storeId,itemType,externalCode,deltaQty,reasonCode\nstore-1,Product,LAT-1,"10,5",Correction`;
    const file = { text: () => Promise.resolve(csv) };
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: { item: () => file } });

    await page.onImportFileSelected({ target: input } as unknown as Event);

    expect(page.importPreviewRows()[0].validationError).toContain('DeltaQty usa coma decimal');
  });

  it('muestra banner de drift cuando apply devuelve fallas por concurrencia/stock', async () => {
    const page = fixture.componentInstance;
    page.importPreviewRows.set([
      {
        lineNo: 1,
        itemType: 'Product',
        externalCode: 'LAT-1',
        itemId: '',
        deltaQty: -2,
        reasonCode: 'Correction',
        referenceId: null,
        note: null,
        validationError: null,
        qtyBefore: 4,
        qtyAfter: 2,
        validationStatus: 'Valid',
        validationMessage: null,
      },
    ]);
    page.importValidatedSnapshot.set({
      validatedAtUtc: '2026-01-01T00:00:00.000Z',
      payloadHash: page['calculateImportPayloadHash'](
        page['buildImportPayload'](page.importPreviewRows()),
      ),
    });
    createInventoryBatchAdjustmentV2.mockResolvedValueOnce({
      batchClientOperationId: 'batch-2',
      totals: { appliedCount: 0, failedCount: 1 },
      lines: [
        {
          lineNo: 1,
          itemKey: 'Product:LAT-1',
          status: 'Failed',
          errorCode: 'CONCURRENCY_CONFLICT',
          message: 'Drift',
          qtyBefore: 2,
          qtyAfter: 0,
        },
      ],
    });

    await page.applyBatchAdjustmentFromImport();

    expect(page.importDriftDetected()).toBe(true);
    expect(page.batchResultMessage()).toContain('Revalidar y reintentar solo fallidas');
  });

  it('revalidar dispara validate de nuevo sin recargar archivo', async () => {
    vi.useFakeTimers();
    const page = fixture.componentInstance;
    const csv =
      'storeId,itemType,externalCode,deltaQty,reasonCode,referenceId,note\nstore-1,Product,LAT-1,-2,Correction,ref-1,nota';
    const file = { text: () => Promise.resolve(csv) };
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: { item: () => file } });

    await page.onImportFileSelected({ target: input } as unknown as Event);
    vi.advanceTimersByTime(260);
    await Promise.resolve();
    expect(validateInventoryBatchAdjustmentV2).toHaveBeenCalledTimes(1);

    page.triggerImportValidation();
    await Promise.resolve();

    expect(validateInventoryBatchAdjustmentV2).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('cambio de store/reason invalida estado validado y deshabilita Apply hasta revalidar', async () => {
    vi.useFakeTimers();
    const page = fixture.componentInstance;
    const csv =
      'storeId,itemType,externalCode,deltaQty,reasonCode,referenceId,note\nstore-1,Product,LAT-1,-2,Correction,ref-1,nota';
    const file = { text: () => Promise.resolve(csv) };
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: { item: () => file } });

    await page.onImportFileSelected({ target: input } as unknown as Event);
    vi.advanceTimersByTime(260);
    await Promise.resolve();
    expect(page.canApplyImport()).toBe(true);

    page.storeIdControl.setValue('store-2');

    expect(page.importValidatedSnapshot()).toBeNull();
    expect(page.canApplyImport()).toBe(false);

    page.batchReasonControl.setValue('Damage');
    expect(page.importValidatedSnapshot()).toBeNull();

    vi.advanceTimersByTime(260);
    await Promise.resolve();

    expect(page.importValidatedSnapshot()).not.toBeNull();
    expect(page.canApplyImport()).toBe(true);
    vi.useRealTimers();
  });

  it('pide confirmación cuando validCount supera umbral configurado', async () => {
    const page = fixture.componentInstance;
    page.importPreviewRows.set(
      Array.from({ length: 201 }, (_, index) => ({
        lineNo: index + 1,
        itemType: 'Product' as const,
        externalCode: `LAT-${index + 1}`,
        itemId: '',
        deltaQty: -1,
        reasonCode: 'Correction' as const,
        referenceId: null,
        note: null,
        validationError: null,
        qtyBefore: 4,
        qtyAfter: 3,
        validationStatus: 'Valid' as const,
        validationMessage: null,
      })),
    );
    page.importValidatedSnapshot.set({
      validatedAtUtc: '2026-01-01T00:00:00.000Z',
      payloadHash: page['calculateImportPayloadHash'](
        page['buildImportPayload'](page.importPreviewRows()),
      ),
    });
    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(false);

    await page.applyBatchAdjustmentFromImport();

    expect(confirmSpy).toHaveBeenCalledWith('Estás por ajustar 201 líneas; continuar?');
    expect(createInventoryBatchAdjustmentV2).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('mapea NEGATIVE_STOCK en errores de batch', async () => {
    const page = fixture.componentInstance;
    createInventoryBatchAdjustmentV2.mockRejectedValueOnce(
      new HttpErrorResponse({ status: 409, error: { reason: 'NegativeStockNotAllowed' } }),
    );
    page['inventoryFacade'].rows.set([
      {
        itemType: 'Product',
        itemId: 'product-1',
        name: 'Latte',
        sku: 'LAT-1',
        categoryName: 'Bebidas',
        isInventoryTracked: true,
        onHandQty: 1.25,
      },
    ]);
    page.batchDeltaControl.setValue(-3);
    page.toggleRowSelection(page.inventoryV2Rows()[0], true);

    await page.applyBatchAdjustmentFromSelection();

    expect(page.batchResultMessage()).toContain('stock negativo');
  });
  it('reintento construye payload solo con líneas fallidas y nuevo clientOperationId', async () => {
    vi.useFakeTimers();
    const page = fixture.componentInstance;
    page.batchResultRows.set([
      {
        lineNo: 1,
        itemType: 'Product',
        externalCode: 'LAT-1',
        itemId: '',
        deltaQty: -1,
        status: 'Failed',
        errorCode: 'UNKNOWN_ITEM',
        message: 'No existe',
        qtyBefore: null,
        qtyAfter: null,
        deltaApplied: null,
        adjustmentId: '',
      },
      {
        lineNo: 2,
        itemType: 'Extra',
        externalCode: '',
        itemId: 'extra-1',
        deltaQty: -2,
        status: 'Failed',
        errorCode: 'NEGATIVE_STOCK',
        message: 'Negativo',
        qtyBefore: 1,
        qtyAfter: null,
        deltaApplied: null,
        adjustmentId: '',
      },
      {
        lineNo: 3,
        itemType: 'Product',
        externalCode: 'LAT-OK',
        itemId: '',
        deltaQty: -1,
        status: 'Applied',
        errorCode: '',
        message: '',
        qtyBefore: 4,
        qtyAfter: 3,
        deltaApplied: -1,
        adjustmentId: 'adj-1',
      },
    ]);
    page.batchExecutionResult.set({
      batchClientOperationId: 'batch-1',
      totals: { appliedCount: 1, failedCount: 2 },
      lines: [],
    });

    page.retryFailedImportLines();
    vi.advanceTimersByTime(260);
    await Promise.resolve();

    expect(validateInventoryBatchAdjustmentV2).toHaveBeenCalled();
    const payload = validateInventoryBatchAdjustmentV2.mock.calls.at(-1)?.[0];
    expect(payload.items).toHaveLength(2);
    expect(
      payload.items.map((item: { lineClientOperationId: string }) => item.lineClientOperationId),
    ).toEqual(['validate-line-1', 'validate-line-2']);
    expect(payload.items.map((item: { quantityDelta: number }) => item.quantityDelta)).toEqual([
      -1, -2,
    ]);
    expect(payload.clientOperationId).toBeTruthy();
    expect(payload.clientOperationId).not.toBe('batch-1');
    vi.useRealTimers();
  });

  it('botón de reintentar solo aparece con fallidas y click dispara validate', async () => {
    vi.useFakeTimers();
    const page = fixture.componentInstance;
    page.batchExecutionResult.set({
      batchClientOperationId: 'batch-1',
      totals: { appliedCount: 1, failedCount: 0 },
      lines: [],
    });
    page.batchResultRows.set([
      {
        lineNo: 1,
        itemType: 'Product',
        externalCode: 'LAT-OK',
        itemId: '',
        deltaQty: -1,
        status: 'Applied',
        errorCode: '',
        message: '',
        qtyBefore: 4,
        qtyAfter: 3,
        deltaApplied: -1,
        adjustmentId: 'adj-1',
      },
    ]);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-testid="inventory-v2-result-retry-failed"]'),
    ).toBeNull();

    page.batchExecutionResult.set({
      batchClientOperationId: 'batch-2',
      totals: { appliedCount: 1, failedCount: 1 },
      lines: [],
    });
    page.batchResultRows.set([
      {
        lineNo: 1,
        itemType: 'Product',
        externalCode: 'LAT-1',
        itemId: '',
        deltaQty: -1,
        status: 'Failed',
        errorCode: 'UNKNOWN_ITEM',
        message: 'No existe',
        qtyBefore: null,
        qtyAfter: null,
        deltaApplied: null,
        adjustmentId: '',
      },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(page.canRetryFailedLines()).toBe(true);
    page.retryFailedImportLines();
    vi.advanceTimersByTime(260);
    await Promise.resolve();

    expect(validateInventoryBatchAdjustmentV2).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('reintento: validate exitoso habilita apply; validate fallido muestra error y no habilita apply', async () => {
    const page = fixture.componentInstance;
    page.batchResultRows.set([
      {
        lineNo: 1,
        itemType: 'Product',
        externalCode: 'LAT-1',
        itemId: '',
        deltaQty: -1,
        status: 'Failed',
        errorCode: 'UNKNOWN_ITEM',
        message: 'No existe',
        qtyBefore: null,
        qtyAfter: null,
        deltaApplied: null,
        adjustmentId: '',
      },
    ]);
    page.retryFailedImportLines();
    await Promise.resolve();

    expect(page.importValidateError()).toBeNull();
    expect(page.canApplyImport()).toBe(true);

    validateInventoryBatchAdjustmentV2.mockRejectedValueOnce(new Error('failed'));
    page.retryFailedImportLines();
    await Promise.resolve();

    expect(page.importValidateError()).toContain('No se pudo validar');
    expect(page.canApplyImport()).toBe(false);
  });

  it('corridas muestran Run #1 y Reintento #2', async () => {
    const page = fixture.componentInstance;
    page.importPreviewRows.set([
      {
        lineNo: 1,
        itemType: 'Product',
        externalCode: 'LAT-1',
        itemId: '',
        deltaQty: -1,
        reasonCode: 'Correction',
        referenceId: null,
        note: null,
        validationError: null,
        qtyBefore: 4,
        qtyAfter: 3,
        validationStatus: 'Valid',
        validationMessage: null,
      },
    ]);
    page.importValidatedSnapshot.set({
      validatedAtUtc: '2026-01-01T00:00:00.000Z',
      payloadHash: page['calculateImportPayloadHash'](
        page['buildImportPayload'](page.importPreviewRows()),
      ),
    });

    createInventoryBatchAdjustmentV2.mockResolvedValueOnce({
      batchClientOperationId: 'batch-a',
      totals: { appliedCount: 0, failedCount: 1 },
      lines: [
        {
          lineNo: 1,
          itemKey: 'Product:LAT-1',
          status: 'Failed',
          errorCode: 'UNKNOWN_ITEM',
          message: 'No existe',
        },
      ],
    });

    await page.applyBatchAdjustmentFromImport();
    expect(page.importRuns().map((run) => run.label)).toEqual(['Run #1']);

    createInventoryBatchAdjustmentV2.mockResolvedValueOnce({
      batchClientOperationId: 'batch-b',
      totals: { appliedCount: 1, failedCount: 0 },
      lines: [
        {
          lineNo: 1,
          itemKey: 'Product:LAT-1',
          status: 'Applied',
          qtyBefore: 4,
          qtyAfter: 3,
          deltaApplied: -1,
          adjustmentId: 'adj-1',
        },
      ],
    });

    page.retryFailedImportLines();
    await Promise.resolve();
    page.importPreviewRows.update((rows) =>
      rows.map((row) => ({ ...row, validationStatus: 'Valid', qtyBefore: 4, qtyAfter: 3 })),
    );
    page.importValidatedSnapshot.set({
      validatedAtUtc: '2026-01-01T00:01:00.000Z',
      payloadHash: page['calculateImportPayloadHash'](
        page['buildImportPayload'](page.importPreviewRows()),
      ),
    });
    await page.applyBatchAdjustmentFromImport();

    expect(page.importRuns().map((run) => run.label)).toEqual(['Reintento #2', 'Run #1']);
  });
});
