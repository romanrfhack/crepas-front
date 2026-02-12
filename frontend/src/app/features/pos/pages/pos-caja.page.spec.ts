import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PosCajaPage } from './pos-caja.page';
import { PosCatalogSnapshotService } from '../services/pos-catalog-snapshot.service';
import { PosSalesApiService } from '../services/pos-sales-api.service';

describe('PosCajaPage', () => {
  let fixture: ComponentFixture<PosCajaPage>;
  let salesCalls: { payload: { clientSaleId: string | null }; correlationId: string }[];

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
          provide: PosSalesApiService,
          useValue: {
            createSale: async (payload: { clientSaleId: string | null }, correlationId: string) => {
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
      receivedAmount: 20,
    });

    await fixture.componentInstance.confirmPayment({
      method: 'Cash',
      amount: 10,
      reference: null,
      receivedAmount: 20,
    });

    expect(salesCalls.length).toBe(2);
    expect(salesCalls[0]?.payload.clientSaleId).toBeTruthy();
    expect(salesCalls[0]?.payload.clientSaleId).toBe(salesCalls[1]?.payload.clientSaleId);
    expect(fixture.componentInstance.cartItems().length).toBe(0);
  });
});
