import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CreateSaleRequestDto } from '../models/pos.models';
import { PosCatalogSnapshotService } from '../services/pos-catalog-snapshot.service';
import { PosSalesApiService } from '../services/pos-sales-api.service';
import { PosShiftApiService } from '../services/pos-shift-api.service';
import { StoreContextService } from '../services/store-context.service';
import { PosTimezoneService } from '../services/pos-timezone.service';
import { PosWholesaleApiService } from '../services/pos-wholesale-api.service';
import { PosCajaPage } from './pos-caja.page';

describe('PosCajaPage', () => {
  let fixture: ComponentFixture<PosCajaPage>;
  let currentShiftResponse: Record<string, unknown> | null;
  let openShiftCalls: Array<{
    startingCashAmount: number;
    notes?: string | null;
    clientOperationId?: string | null;
  }>;
  let salesCalls: { payload: CreateSaleRequestDto; correlationId: string }[];
  let voidCalls: { saleId: string; payload: { clientVoidId: string }; correlationId: string }[];
  let closePreviewCalls: unknown[];
  let invalidateCalls: (string | undefined)[];
  let quotePricingCalls = 0;
  let validateAvailabilityCalls = 0;

  beforeEach(async () => {
    currentShiftResponse = {
      id: 'shift-1',
      openedAtUtc: '2026-02-12T10:00:00Z',
      openedByUserId: 'u1',
      openedByEmail: 'cashier@local',
      openingCashAmount: 0,
      closedAtUtc: null,
      closedByUserId: null,
      closedByEmail: null,
      closingCashAmount: null,
      openNotes: null,
      closeNotes: null,
    };
    openShiftCalls = [];
    salesCalls = [];
    voidCalls = [];
    closePreviewCalls = [];
    invalidateCalls = [];
    quotePricingCalls = 0;
    validateAvailabilityCalls = 0;

    await TestBed.configureTestingModule({
      imports: [PosCajaPage],
      providers: [
        {
          provide: PosCatalogSnapshotService,
          useValue: {
            getSnapshot: () =>
              of({
                storeId: 'store-1',
                timeZoneId: 'America/Mexico_City',
                generatedAtUtc: '2026-02-12T10:00:00Z',
                catalogVersion: 'v1',
                etagSeed: 'seed',
                categories: [],
                products: [],
                optionSets: [],
                optionItems: [],
                schemas: [],
                selectionGroups: [],
                extras: [],
                includedItems: [],
                overrides: [],
                versionStamp: 'v1',
              }),
            invalidate: (storeId?: string) => invalidateCalls.push(storeId),
          },
        },
        {
          provide: PosShiftApiService,
          useValue: {
            getCurrentShift: async () => currentShiftResponse,
            openShift: async (
              startingCashAmount: number,
              notes?: string | null,
              clientOperationId?: string | null,
            ) => {
              openShiftCalls.push({ startingCashAmount, notes, clientOperationId });
              return {
                id: 'shift-2',
                openedAtUtc: '2026-02-12T11:00:00Z',
                openedByUserId: 'u1',
                openedByEmail: 'cashier@local',
                openingCashAmount: 100,
                closedAtUtc: null,
                closedByUserId: null,
                closedByEmail: null,
                closingCashAmount: null,
                openNotes: null,
                closeNotes: null,
              };
            },
            closePreviewV2: async (payload: unknown) => {
              closePreviewCalls.push(payload);
              return {
                shiftId: 'shift-1',
                openedAtUtc: '2026-02-12T10:00:00Z',
                openingCashAmount: 100,
                salesCashTotal: 250,
                expectedCashAmount: 350,
              };
            },
            closeShift: async () => ({
              shiftId: 'shift-2',
              openedAtUtc: '2026-02-12T11:00:00Z',
              closedAtUtc: '2026-02-12T20:00:00Z',
              openingCashAmount: 100,
              salesCashTotal: 250,
              expectedCashAmount: 350,
              countedCashAmount: 350,
              difference: 0,
              closeNotes: null,
            }),
          },
        },
        {
          provide: PosSalesApiService,
          useValue: {
            createSale: async (payload: CreateSaleRequestDto, correlationId: string) => {
              salesCalls.push({ payload, correlationId });
              if (salesCalls.length === 1) {
                throw new HttpErrorResponse({ status: 0 });
              }

              return {
                saleId: 'sale-1',
                folio: 'POS-001',
                occurredAtUtc: '2026-02-12T16:04:00Z',
                total: 10,
              };
            },
            voidSale: async (
              saleId: string,
              payload: { clientVoidId: string },
              correlationId: string,
            ) => {
              voidCalls.push({ saleId, payload, correlationId });
            },
          },
        },
        {
          provide: PosWholesaleApiService,
          useValue: {
            getTenantWholesalePolicy: async () => ({
              isEnabled: true,
              name: 'Mayoreo base',
              tiers: [{ minQty: 10, discountType: 'Percent', discountValue: 10 }],
            }),
            getProductWholesaleOverride: async () => ({
              productId: 'product-1',
              mode: 'UseTenantDefault',
              tiers: [],
            }),
            quotePricing: async () => {
              quotePricingCalls += 1;
              return {
                lines: [
                  {
                    productId: 'product-1',
                    externalCode: null,
                    qty: 1,
                    baseUnitPrice: 10,
                    appliedUnitPrice: 9,
                    tierApplied: null,
                    lineSubtotal: 9,
                    isMismatch: true,
                    expectedUnitPrice: 9,
                  },
                ],
                totals: { subtotal: 9, total: 9 },
              };
            },
            validateAvailability: async () => {
              validateAvailabilityCalls += 1;
              return {
                ok: true,
                lines: [
                  {
                    productId: 'product-1',
                    externalCode: null,
                    requestedQty: 1,
                    onHandQty: 5,
                    ok: true,
                    message: null,
                  },
                ],
                summary: { insufficientCount: 0 },
              };
            },
          },
        },
        PosTimezoneService,
        {
          provide: StoreContextService,
          useValue: {
            getActiveStoreId: () => 'store-1',
            setActiveStoreId: () => undefined,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PosCajaPage);
    fixture.componentInstance.cartItems.set([
      {
        id: 'cart-1',
        productId: 'product-1',
        externalCode: null,
        productName: 'Latte',
        basePrice: 10,
        baseUnitPrice: 10,
        appliedUnitPrice: 10,
        wholesaleTierLabel: null,
        wholesale: {
          isApplied: false,
          minQty: null,
          discountType: null,
          discountValue: null,
          source: null,
        },
        pricingCalculatedAtUtc: null,
        quantity: 1,
        selections: [],
        extras: [],
      },
    ]);
    fixture.detectChanges();
  });

  it('reuses the same clientSaleId when retrying after network error', async () => {
    await fixture.componentInstance.confirmPayment({
      payments: [{ method: 'Cash', amount: 10, reference: null }],
    });

    await fixture.componentInstance.confirmPayment({
      payments: [{ method: 'Cash', amount: 10, reference: null }],
    });

    expect(salesCalls.length).toBe(2);
    expect(salesCalls[0]?.payload.clientSaleId).toBeTruthy();
    expect(salesCalls[0]?.payload.clientSaleId).toBe(salesCalls[1]?.payload.clientSaleId);
    expect(salesCalls[0]?.payload.clientOperationId).toBe(salesCalls[0]?.payload.clientSaleId);
    expect(salesCalls[1]?.payload.clientOperationId).toBe(salesCalls[1]?.payload.clientSaleId);
    expect(fixture.componentInstance.cartItems().length).toBe(0);
  });

  it('reuses the same open-shift clientOperationId when retrying after ambiguous network error', async () => {
    const shiftApi = TestBed.inject(PosShiftApiService) as unknown as {
      getCurrentShift: () => Promise<unknown>;
      openShift: (
        startingCashAmount: number,
        notes?: string | null,
        clientOperationId?: string | null,
      ) => Promise<unknown>;
    };

    let attempts = 0;
    currentShiftResponse = null;
    shiftApi.getCurrentShift = async () => null;
    shiftApi.openShift = async (startingCashAmount, notes, clientOperationId) => {
      openShiftCalls.push({ startingCashAmount, notes, clientOperationId });
      attempts += 1;
      if (attempts === 1) {
        throw new HttpErrorResponse({ status: 0 });
      }

      return {
        id: 'shift-2',
        openedAtUtc: '2026-02-12T11:00:00Z',
        openedByUserId: 'u1',
        openedByEmail: 'cashier@local',
        openingCashAmount: 100,
        closedAtUtc: null,
        closedByUserId: null,
        closedByEmail: null,
        closingCashAmount: null,
        openNotes: null,
        closeNotes: null,
      };
    };

    fixture.componentInstance.currentShift.set(null);
    fixture.componentInstance.showOpenShiftModal.set(true);

    await fixture.componentInstance.submitOpenShift();
    await fixture.componentInstance.submitOpenShift();

    expect(openShiftCalls.length).toBe(2);
    expect(openShiftCalls[0]?.clientOperationId).toBeTruthy();
    expect(openShiftCalls[0]?.clientOperationId).toBe(openShiftCalls[1]?.clientOperationId);
    expect(fixture.componentInstance.currentShift()?.id).toBe('shift-2');
    expect(fixture.componentInstance.showOpenShiftModal()).toBe(false);
  });

  it('reconciles open-shift state after ambiguous failure when backend already opened the shift', async () => {
    const shiftApi = TestBed.inject(PosShiftApiService) as unknown as {
      getCurrentShift: () => Promise<unknown>;
      openShift: (
        startingCashAmount: number,
        notes?: string | null,
        clientOperationId?: string | null,
      ) => Promise<unknown>;
    };

    shiftApi.openShift = async (startingCashAmount, notes, clientOperationId) => {
      openShiftCalls.push({ startingCashAmount, notes, clientOperationId });
      throw new HttpErrorResponse({ status: 0 });
    };

    shiftApi.getCurrentShift = async () => ({
      id: 'shift-recovered',
      openedAtUtc: '2026-02-12T11:30:00Z',
      openedByUserId: 'u1',
      openedByEmail: 'cashier@local',
      openingCashAmount: 50,
      closedAtUtc: null,
      closedByUserId: null,
      closedByEmail: null,
      closingCashAmount: null,
      openNotes: null,
      closeNotes: null,
    });

    fixture.componentInstance.currentShift.set(null);
    fixture.componentInstance.showOpenShiftModal.set(true);

    await fixture.componentInstance.submitOpenShift();

    expect(openShiftCalls.length).toBe(1);
    expect(fixture.componentInstance.currentShift()?.id).toBe('shift-recovered');
    expect(fixture.componentInstance.showOpenShiftModal()).toBe(false);
    expect(fixture.componentInstance.inProgressOpenShiftOperationId()).toBeNull();
  });

  it('updates counted total and difference in real time from denomination counts', async () => {
    await fixture.componentInstance.startCloseShift();

    const hundredControl = fixture.componentInstance.getCountControl(3);
    hundredControl.setValue(2);

    expect(fixture.componentInstance.countedTotal()).toBe(200);
    expect(fixture.componentInstance.closeDifference()).toBe(-150);

    const fiftyCentControl = fixture.componentInstance.getCountControl(10);
    fiftyCentControl.setValue(3);

    expect(fixture.componentInstance.countedTotal()).toBe(201.5);
    expect(fixture.componentInstance.closeDifference()).toBe(-148.5);
  });

  it('recovers close-shift conflict by reconciling stale state', async () => {
    const shiftApi = TestBed.inject(PosShiftApiService) as unknown as {
      getCurrentShift: () => Promise<unknown>;
      closeShift: () => Promise<unknown>;
    };

    shiftApi.closeShift = async () => {
      throw new HttpErrorResponse({
        status: 409,
        error: { detail: 'No open shift found.' },
      });
    };
    shiftApi.getCurrentShift = async () => null;

    fixture.componentInstance.currentShift.set({
      id: 'shift-1',
      openedAtUtc: '2026-02-12T10:00:00Z',
      openedByUserId: 'u1',
      openedByEmail: 'cashier@local',
      openingCashAmount: 100,
      closedAtUtc: null,
      closedByUserId: null,
      closedByEmail: null,
      closingCashAmount: null,
      openNotes: null,
      closeNotes: null,
    });
    fixture.componentInstance.closePreview.set({
      shiftId: 'shift-1',
      openedAtUtc: '2026-02-12T10:00:00Z',
      openingCashAmount: 100,
      salesCashTotal: 25,
      expectedCashAmount: 125,
      countedCashAmount: null,
      difference: null,
      breakdown: {
        cashAmount: 25,
        cardAmount: 0,
        transferAmount: 0,
        totalSalesCount: 1,
      },
    });
    fixture.componentInstance.showCloseShiftModal.set(true);
    fixture.componentInstance.closeShiftForm.patchValue({ reason: 'Arqueo reconciliado' });

    await fixture.componentInstance.submitCloseShift();

    expect(fixture.componentInstance.currentShift()).toBeNull();
    expect(fixture.componentInstance.closePreview()).toBeNull();
    expect(fixture.componentInstance.showCloseShiftModal()).toBe(false);
    expect(fixture.componentInstance.errorMessage()).toContain('ya no está abierto');
  });

  it('builds CreateSaleRequest with payments[] and leaves legacy payment undefined', async () => {
    await fixture.componentInstance.confirmPayment({
      payments: [
        { method: 'Cash', amount: 4, reference: null },
        { method: 'Card', amount: 6, reference: 'AUTH-123' },
      ],
    });

    expect(salesCalls.length).toBe(1);
    expect(salesCalls[0]?.payload.payments.length).toBe(2);
    expect(salesCalls[0]?.payload.payments[1]?.reference).toBe('AUTH-123');
    expect(salesCalls[0]?.payload.payment).toBeUndefined();
  });

  it('sends clientVoidId and refreshes close preview after successful void', async () => {
    fixture.componentInstance.currentShift.set({
      id: 'shift-1',
      openedAtUtc: '2026-02-12T10:00:00Z',
      openedByUserId: 'u1',
      openedByEmail: 'cashier@local',
      openingCashAmount: 100,
      closedAtUtc: null,
      closedByUserId: null,
      closedByEmail: null,
      closingCashAmount: null,
      openNotes: null,
      closeNotes: null,
    });
    fixture.componentInstance.showCloseShiftModal.set(true);
    fixture.componentInstance.openVoidModal({
      saleId: 'sale-void-1',
      folio: 'POS-VOID-1',
      total: 10,
      occurredAtUtc: '2026-02-12T16:04:00Z',
      status: 'Completed',
    });

    await fixture.componentInstance.confirmVoidSale();

    expect(voidCalls.length).toBe(1);
    expect(voidCalls[0]?.saleId).toBe('sale-void-1');
    expect(voidCalls[0]?.payload.clientVoidId).toBeTruthy();
    expect(closePreviewCalls.length).toBe(1);
  });

  it('disables critical caja actions while loading is active', () => {
    fixture.componentInstance.cartExpanded.set(true);
    fixture.componentInstance.showPayment.set(true);
    fixture.componentInstance.showCloseShiftModal.set(true);
    fixture.componentInstance.showVoidModal.set(true);
    fixture.componentInstance.loading.set(true);
    fixture.detectChanges();

    expect(
      (fixture.nativeElement.querySelector('[data-testid="refresh-catalog"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (fixture.nativeElement.querySelector('[data-testid="refresh-shift"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (fixture.nativeElement.querySelector('[data-testid="open-payment"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (fixture.nativeElement.querySelector('[data-testid="cancel-payment"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (fixture.nativeElement.querySelector('[data-testid="cancel-close-shift"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (fixture.nativeElement.querySelector('[data-testid="cancel-void"]') as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('keeps void modal open and exposes 403 state before succeeding on retry', async () => {
    const forbiddenResponse = new HttpErrorResponse({
      status: 403,
      error: { code: 'FORBIDDEN_VOID' },
    });
    const successfulVoidCalls: Array<{ saleId: string; payload: { clientVoidId: string } }> = [];

    const salesApi = TestBed.inject(PosSalesApiService) as unknown as {
      voidSale: (
        saleId: string,
        payload: { reasonCode: string; reasonText?: string; note?: string; clientVoidId: string },
        correlationId: string,
      ) => Promise<unknown>;
    };

    let attempts = 0;
    salesApi.voidSale = async (saleId, payload) => {
      attempts += 1;
      successfulVoidCalls.push({ saleId, payload });
      if (attempts === 1) {
        throw forbiddenResponse;
      }
    };

    fixture.componentInstance.currentShift.set({
      id: 'shift-1',
      openedAtUtc: '2026-02-12T10:00:00Z',
      openedByUserId: 'u1',
      openedByEmail: 'cashier@local',
      openingCashAmount: 100,
      closedAtUtc: null,
      closedByUserId: null,
      closedByEmail: null,
      closingCashAmount: null,
      openNotes: null,
      closeNotes: null,
    });
    fixture.componentInstance.openVoidModal({
      saleId: 'sale-void-2',
      folio: 'POS-VOID-2',
      total: 12,
      occurredAtUtc: '2026-02-12T16:04:00Z',
      status: 'Completed',
    });

    await fixture.componentInstance.confirmVoidSale();
    fixture.detectChanges();

    expect(fixture.componentInstance.showVoidModal()).toBeTruthy();
    expect(fixture.componentInstance.voidForbiddenError()).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="void-403"]')).toBeTruthy();

    await fixture.componentInstance.confirmVoidSale();

    expect(successfulVoidCalls.length).toBe(2);
    expect(successfulVoidCalls[0]?.payload.clientVoidId).toBeTruthy();
    expect(successfulVoidCalls[0]?.payload.clientVoidId).toBe(
      successfulVoidCalls[1]?.payload.clientVoidId,
    );
    expect(fixture.componentInstance.showVoidModal()).toBeFalsy();
    expect(fixture.componentInstance.voidForbiddenError()).toBeFalsy();
  });

  it('blocks unavailable products from being added to cart', async () => {
    await fixture.componentInstance.onProductSelected({
      id: 'product-unavailable',
      externalCode: null,
      name: 'Sin stock',
      categoryId: 'c-1',
      subcategoryName: null,
      basePrice: 100,
      isActive: true,
      isAvailable: false,
      customizationSchemaId: null,
    });

    expect(
      fixture.componentInstance
        .cartItems()
        .some((item) => item.productId === 'product-unavailable'),
    ).toBe(false);
  });

  it('applies and reverts wholesale tier when quantity changes', async () => {
    fixture.componentInstance.cartItems.set([
      {
        id: 'cart-1',
        productId: 'product-1',
        externalCode: null,
        productName: 'Latte',
        basePrice: 10,
        baseUnitPrice: 10,
        appliedUnitPrice: 10,
        wholesaleTierLabel: null,
        wholesale: {
          isApplied: false,
          minQty: null,
          discountType: null,
          discountValue: null,
          source: null,
        },
        pricingCalculatedAtUtc: null,
        quantity: 9,
        selections: [],
        extras: [],
      },
    ]);

    fixture.componentInstance.increaseQty('cart-1');
    expect(fixture.componentInstance.cartItems()[0]?.appliedUnitPrice).toBe(9);

    fixture.componentInstance.increaseQty('cart-1');
    expect(fixture.componentInstance.cartItems()[0]?.appliedUnitPrice).toBe(9);

    fixture.componentInstance.decreaseQty('cart-1');
    fixture.componentInstance.decreaseQty('cart-1');
    expect(fixture.componentInstance.cartItems()[0]?.appliedUnitPrice).toBe(10);
  });

  it('shows out-of-stock alert with available qty when sale returns 409 OutOfStock', async () => {
    const salesApi = TestBed.inject(PosSalesApiService) as unknown as {
      createSale: (payload: CreateSaleRequestDto, correlationId: string) => Promise<unknown>;
    };
    salesApi.createSale = async () => {
      throw new HttpErrorResponse({
        status: 409,
        error: {
          title: 'Conflict',
          extensions: {
            reason: 'OutOfStock',
            itemName: 'Latte',
            availableQty: 2,
            itemType: 'Product',
            itemId: 'product-1',
          },
        },
      });
    };

    await fixture.componentInstance.confirmPayment({
      payments: [{ method: 'Cash', amount: 10, reference: null }],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="outofstock-alert"]')).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('[data-testid="outofstock-item-name"]')?.textContent,
    ).toContain('Latte');
    expect(
      fixture.nativeElement.querySelector('[data-testid="outofstock-available-qty"]')?.textContent,
    ).toContain('2');
  });

  it('shows unavailable alert state and refresh CTA when create sale returns 409 item unavailable', async () => {
    const salesApi = TestBed.inject(PosSalesApiService) as unknown as {
      createSale: (payload: CreateSaleRequestDto, correlationId: string) => Promise<unknown>;
    };
    salesApi.createSale = async () => {
      throw new HttpErrorResponse({
        status: 409,
        error: {
          title: 'ItemUnavailable',
          extensions: { itemType: 'Product', itemId: 'product-1', itemName: 'Waffle Fresa' },
        },
      });
    };

    await fixture.componentInstance.confirmPayment({
      payments: [{ method: 'Cash', amount: 10, reference: null }],
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.errorMessage()).toContain('No disponible');
    expect(fixture.componentInstance.canRefreshCatalogAfterUnavailable()).toBe(true);
    expect(fixture.componentInstance.unavailableItemName()).toBe('Waffle Fresa');
    expect(fixture.nativeElement.querySelector('[data-testid="unavailable-alert"]')).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('[data-testid="refresh-catalog-unavailable"]'),
    ).toBeTruthy();

    await fixture.componentInstance.refreshCatalogAfterUnavailable();
    expect(invalidateCalls.length).toBe(1);
  });
  it('shows unavailable alert even when backend only provides unavailable title/detail', async () => {
    const salesApi = TestBed.inject(PosSalesApiService) as unknown as {
      createSale: (payload: CreateSaleRequestDto, correlationId: string) => Promise<unknown>;
    };
    salesApi.createSale = async () => {
      throw new HttpErrorResponse({
        status: 409,
        error: {
          title: 'ItemUnavailable',
          detail: 'Producto no disponible en catálogo actual',
          extensions: { itemName: 'Waffle Fresa' },
        },
      });
    };

    await fixture.componentInstance.confirmPayment({
      payments: [{ method: 'Cash', amount: 10, reference: null }],
    });

    expect(fixture.componentInstance.errorMessage()).toContain('No disponible');
    expect(fixture.componentInstance.canRefreshCatalogAfterUnavailable()).toBe(true);
    expect(fixture.componentInstance.unavailableItemName()).toBe('Waffle Fresa');
  });

  it('keeps unavailable refresh alert rendered even if generic error message is cleared', () => {
    fixture.componentInstance.errorMessage.set(null);
    fixture.componentInstance.canRefreshCatalogAfterUnavailable.set(true);
    fixture.componentInstance.unavailableItemName.set('Waffle Fresa');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="unavailable-alert"]')).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('[data-testid="refresh-catalog-unavailable"]'),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('[data-testid="unavailable-item-name"]')?.textContent,
    ).toContain('Waffle Fresa');
  });

  it('shows unavailable alert when api error is wrapped inside nested error objects', async () => {
    const salesApi = TestBed.inject(PosSalesApiService) as unknown as {
      createSale: (payload: CreateSaleRequestDto, correlationId: string) => Promise<unknown>;
    };
    salesApi.createSale = async () => {
      throw {
        error: new HttpErrorResponse({
          status: 409,
          error: {
            title: 'ItemUnavailable',
            extensions: { itemType: 'Product', itemId: 'product-1', itemName: 'Waffle Fresa' },
          },
        }),
      };
    };

    await fixture.componentInstance.confirmPayment({
      payments: [{ method: 'Cash', amount: 10, reference: null }],
    });

    expect(fixture.componentInstance.errorMessage()).toContain('No disponible');
    expect(fixture.componentInstance.canRefreshCatalogAfterUnavailable()).toBe(true);
    expect(fixture.componentInstance.unavailableItemName()).toBe('Waffle Fresa');
  });

  it('treats unknown 409 create-sale conflicts as unavailable to allow catalog refresh', async () => {
    const salesApi = TestBed.inject(PosSalesApiService) as unknown as {
      createSale: (payload: CreateSaleRequestDto, correlationId: string) => Promise<unknown>;
    };
    salesApi.createSale = async () => {
      throw new HttpErrorResponse({
        status: 409,
        error: {
          title: 'Conflict',
          detail: 'The request could not be completed because the resource state changed.',
        },
      });
    };

    await fixture.componentInstance.confirmPayment({
      payments: [{ method: 'Cash', amount: 10, reference: null }],
    });

    expect(fixture.componentInstance.errorMessage()).toContain('No disponible');
    expect(fixture.componentInstance.canRefreshCatalogAfterUnavailable()).toBe(true);
  });

  it('shows idempotency conflict message when backend returns IDEMPOTENCY_CONFLICT', async () => {
    const salesApi = TestBed.inject(PosSalesApiService) as unknown as {
      createSale: (payload: CreateSaleRequestDto, correlationId: string) => Promise<unknown>;
    };
    salesApi.createSale = async () => {
      throw new HttpErrorResponse({
        status: 409,
        error: {
          detail: 'IDEMPOTENCY_CONFLICT',
        },
      });
    };

    await fixture.componentInstance.confirmPayment({
      payments: [{ method: 'Cash', amount: 10, reference: null }],
    });

    expect(fixture.componentInstance.errorMessage()).toContain('idempotencia');
    expect(fixture.componentInstance.canRefreshCatalogAfterUnavailable()).toBe(false);
  });

  it('calls quote and availability when opening checkout', async () => {
    fixture.componentInstance.openPaymentModal();
    await fixture.whenStable();

    expect(quotePricingCalls).toBe(1);
    expect(validateAvailabilityCalls).toBe(1);
  });

  it('blocks confirm when availability validation fails', async () => {
    const wholesaleApi = TestBed.inject(PosWholesaleApiService) as unknown as {
      validateAvailability: () => Promise<unknown>;
    };

    wholesaleApi.validateAvailability = async () => ({
      ok: false,
      lines: [
        {
          productId: 'product-1',
          externalCode: null,
          requestedQty: 2,
          onHandQty: 1,
          ok: false,
          message: 'Stock insuficiente',
        },
      ],
      summary: { insufficientCount: 1 },
    });

    await fixture.componentInstance.canCheckoutTicket();
    await fixture.componentInstance.confirmPayment({
      payments: [{ method: 'Cash', amount: 10, reference: null }],
    });

    expect(salesCalls.length).toBe(0);
    expect(fixture.componentInstance.checkoutInsufficientLines().length).toBe(1);
  });

  it('updates pricing snapshot on quote mismatch', async () => {
    await fixture.componentInstance.canCheckoutTicket();

    expect(fixture.componentInstance.checkoutPricingUpdated()).toBe(true);
    expect(fixture.componentInstance.cartItems()[0]?.appliedUnitPrice).toBe(9);
  });

  it('renders insufficient list and adjusts quantity to available', async () => {
    fixture.componentInstance.showPayment.set(true);
    fixture.componentInstance.checkoutInsufficientLines.set([
      {
        productId: 'product-1',
        externalCode: null,
        requestedQty: 5,
        onHandQty: 2,
        ok: false,
        message: 'Stock insuficiente',
      },
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="insufficient-lines"]')).toBeTruthy();

    fixture.componentInstance.adjustLineToAvailable({
      productId: 'product-1',
      externalCode: null,
      requestedQty: 5,
      onHandQty: 2,
      ok: false,
      message: 'Stock insuficiente',
    });

    expect(fixture.componentInstance.cartItems()[0]?.quantity).toBe(2);
  });
});
