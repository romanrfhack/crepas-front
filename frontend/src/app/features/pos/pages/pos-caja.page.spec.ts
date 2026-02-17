import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CreateSaleRequestDto } from '../models/pos.models';
import { PosCatalogSnapshotService } from '../services/pos-catalog-snapshot.service';
import { PosSalesApiService } from '../services/pos-sales-api.service';
import { PosShiftApiService } from '../services/pos-shift-api.service';
import { StoreContextService } from '../services/store-context.service';
import { PosTimezoneService } from '../services/pos-timezone.service';
import { PosCajaPage } from './pos-caja.page';

describe('PosCajaPage', () => {
  let fixture: ComponentFixture<PosCajaPage>;
  let salesCalls: { payload: CreateSaleRequestDto; correlationId: string }[];
  let voidCalls: { saleId: string; payload: { clientVoidId: string }; correlationId: string }[];
  let closePreviewCalls: unknown[];

  beforeEach(async () => {
    salesCalls = [];
    voidCalls = [];
    closePreviewCalls = [];

    await TestBed.configureTestingModule({
      imports: [PosCajaPage],
      providers: [
        {
          provide: PosCatalogSnapshotService,
          useValue: {
            getSnapshot: async () => ({
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
          },
        },
        {
          provide: PosShiftApiService,
          useValue: {
            getCurrentShift: async () => ({
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
            }),
            openShift: async () => ({
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
            }),
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
        PosTimezoneService,
        {
          provide: StoreContextService,
          useValue: {
            getActiveStoreId: () => null,
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
        productName: 'Latte',
        basePrice: 10,
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
    expect(fixture.componentInstance.cartItems().length).toBe(0);
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
});
