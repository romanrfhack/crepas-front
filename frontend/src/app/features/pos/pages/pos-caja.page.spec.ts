import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PosCajaPage } from './pos-caja.page';
import { PosCatalogSnapshotService } from '../services/pos-catalog-snapshot.service';
import { PosSalesApiService } from '../services/pos-sales-api.service';
import { CreateSaleRequestDto } from '../models/pos.models';
import { PosShiftApiService } from '../services/pos-shift-api.service';
import { PosTimezoneService } from '../services/pos-timezone.service';
import { StoreContextService } from '../services/store-context.service';

describe('PosCajaPage', () => {
  let fixture: ComponentFixture<PosCajaPage>;
  let salesCalls: { payload: CreateSaleRequestDto; correlationId: string }[];

  beforeEach(async () => {
    salesCalls = [];

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
            closePreviewV2: async () => ({
              shiftId: 'shift-1',
              openedAtUtc: '2026-02-12T10:00:00Z',
              openingCashAmount: 100,
              salesCashTotal: 250,
              expectedCashAmount: 350,
            }),
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

  it('should reuse the same clientSaleId when retrying after network error', async () => {
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

  it('should update counted total and difference in real time from denomination counts', async () => {
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

  it('should always send payments array', async () => {
    await fixture.componentInstance.confirmPayment({
      payments: [
        { method: 'Cash', amount: 4, reference: null },
        { method: 'Card', amount: 6, reference: 'AUTH-123' },
      ],
    });

    expect(salesCalls.length).toBe(1);
    expect(salesCalls[0]?.payload.payments.length).toBe(2);
    expect(salesCalls[0]?.payload.payments[1]?.reference).toBe('AUTH-123');
  });
});
