import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PosCajaPage } from './pos-caja.page';
import { PosCatalogSnapshotService } from '../services/pos-catalog-snapshot.service';
import { PosSalesApiService } from '../services/pos-sales-api.service';
import { CreateSaleRequestDto } from '../models/pos.models';
import { PosShiftApiService } from '../services/pos-shift-api.service';

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
            closeShift: async () => ({
              id: 'shift-2',
              openedAtUtc: '2026-02-12T11:00:00Z',
              openedByUserId: 'u1',
              openedByEmail: 'cashier@local',
              openingCashAmount: 100,
              closedAtUtc: '2026-02-12T20:00:00Z',
              closedByUserId: 'u1',
              closedByEmail: 'cashier@local',
              closingCashAmount: 100,
              openNotes: null,
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
      method: 'Cash',
      amount: 10,
      reference: null,
    });

    await fixture.componentInstance.confirmPayment({
      method: 'Cash',
      amount: 10,
      reference: null,
    });

    expect(salesCalls.length).toBe(2);
    expect(salesCalls[0]?.payload.clientSaleId).toBeTruthy();
    expect(salesCalls[0]?.payload.clientSaleId).toBe(salesCalls[1]?.payload.clientSaleId);
    expect(fixture.componentInstance.cartItems().length).toBe(0);
  });

  it('should always send payment amount as sale total and omit cash ui-only fields', async () => {
    fixture.componentInstance.cartItems.set([
      {
        id: 'cart-1',
        productId: 'product-1',
        productName: 'Latte',
        basePrice: 80,
        quantity: 1,
        selections: [],
        extras: [],
      },
    ]);

    await fixture.componentInstance.confirmPayment({
      method: 'Cash',
      amount: 200,
      reference: null,
    });

    expect(salesCalls.length).toBe(1);
    expect(salesCalls[0]?.payload.payment.amount).toBe(80);
    expect(salesCalls[0]?.payload.payment.method).toBe('Cash');
    expect('receivedAmount' in (salesCalls[0]?.payload.payment ?? {})).toBeFalsy();
    expect('change' in (salesCalls[0]?.payload.payment ?? {})).toBeFalsy();
  });

  it('should send card payments with sale total amount', async () => {
    await fixture.componentInstance.confirmPayment({
      method: 'Card',
      amount: 999,
      reference: 'AUTH-123',
    });

    expect(salesCalls.length).toBe(1);
    expect(salesCalls[0]?.payload.payment.amount).toBe(10);
    expect(salesCalls[0]?.payload.payment.method).toBe('Card');
  });
});
