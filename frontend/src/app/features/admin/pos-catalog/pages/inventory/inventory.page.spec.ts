import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PosInventoryAdminApiService } from '../../services/pos-inventory-admin-api.service';
import { InventoryPage } from './inventory.page';

describe('InventoryPage', () => {
  let fixture: ComponentFixture<InventoryPage>;
  let listCalls: string[];
  let upsertCalls: Array<{ storeId: string; itemType: string; itemId: string; onHandQty: number }>;

  beforeEach(async () => {
    listCalls = [];
    upsertCalls = [];

    await TestBed.configureTestingModule({
      imports: [InventoryPage],
      providers: [
        {
          provide: PosInventoryAdminApiService,
          useValue: {
            listInventory: async (storeId: string) => {
              listCalls.push(storeId);
              return [
                {
                  storeId,
                  itemType: 'Product',
                  itemId: 'product-1',
                  itemName: 'Latte',
                  itemSku: 'LAT-1',
                  onHandQty: 4,
                  updatedAtUtc: '2026-01-01T00:00:00Z',
                  isInventoryTracked: true,
                },
                {
                  storeId,
                  itemType: 'Extra',
                  itemId: 'extra-1',
                  itemName: 'Shot',
                  itemSku: null,
                  onHandQty: 2,
                  updatedAtUtc: '2026-01-01T00:00:00Z',
                  isInventoryTracked: true,
                },
                {
                  storeId,
                  itemType: 'OptionItem',
                  itemId: 'option-1',
                  itemName: 'Hielo',
                  onHandQty: 10,
                  updatedAtUtc: '2026-01-01T00:00:00Z',
                },
              ];
            },
            upsertInventory: async (payload: { storeId: string; itemType: string; itemId: string; onHandQty: number }) => {
              upsertCalls.push(payload);
              return payload;
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InventoryPage);
    fixture.componentInstance.storeIdControl.setValue('store-1');
    await fixture.componentInstance.loadInventory();
    fixture.detectChanges();
  });

  it('loads release C inventory and hides option items from editable rows', () => {
    expect(listCalls.at(-1)).toBe('store-1');
    expect(fixture.componentInstance.items().map((item) => item.itemType)).toEqual(['Product', 'Extra']);
  });

  it('saves stock updates by store and item', async () => {
    const row = fixture.componentInstance.items()[0]!;
    fixture.componentInstance.updateDraft('Product-product-1', {
      target: { value: '7' },
    } as unknown as Event);

    await fixture.componentInstance.saveRow(row);

    expect(upsertCalls[0]).toEqual({
      storeId: 'store-1',
      itemType: 'Product',
      itemId: 'product-1',
      onHandQty: 7,
    });
  });

  it('rolls back visual stock and shows row error when save fails', async () => {
    const api = TestBed.inject(PosInventoryAdminApiService) as unknown as {
      upsertInventory: () => Promise<unknown>;
    };
    api.upsertInventory = async () => {
      throw new HttpErrorResponse({ status: 500 });
    };

    const row = fixture.componentInstance.items()[0]!;
    fixture.componentInstance.updateDraft('Product-product-1', {
      target: { value: '9' },
    } as unknown as Event);

    await fixture.componentInstance.saveRow(row);

    expect(fixture.componentInstance.items()[0]?.stockOnHandQty).toBe(4);
    expect(fixture.componentInstance.rowErrors()['Product-product-1']).toContain('No fue posible');
  });

  it('maps option-item backend 400 to explicit not-inventoriable message', async () => {
    const api = TestBed.inject(PosInventoryAdminApiService) as unknown as {
      upsertInventory: () => Promise<unknown>;
    };
    api.upsertInventory = async () => {
      throw new HttpErrorResponse({ status: 400, error: { detail: 'OptionItem inventory is not supported' } });
    };

    const row = fixture.componentInstance.items()[0]!;
    await fixture.componentInstance.saveRow(row);

    expect(fixture.componentInstance.rowErrors()['Product-product-1']).toContain('OptionItem no es inventariable');
  });
});
