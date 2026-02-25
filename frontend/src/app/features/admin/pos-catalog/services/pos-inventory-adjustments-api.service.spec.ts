import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../../../../core/services/api-client';
import { PosInventoryAdjustmentsApiService } from './pos-inventory-adjustments-api.service';

describe('PosInventoryAdjustmentsApiService', () => {
  it('posts create adjustment payload including clientOperationId', async () => {
    const postSpy = vi.fn().mockReturnValue(of({ id: 'adj-1' }));

    TestBed.configureTestingModule({
      providers: [
        PosInventoryAdjustmentsApiService,
        { provide: ApiClient, useValue: { post: postSpy } },
      ],
    });

    const service = TestBed.inject(PosInventoryAdjustmentsApiService);
    await service.createAdjustment({
      storeId: 'store-1',
      itemType: 'Product',
      itemId: 'product-1',
      quantityDelta: -2,
      reason: 'Waste',
      note: 'rotura',
      clientOperationId: '98e782d6-0bf6-4dd3-8269-69ecf5345356',
    });

    expect(postSpy).toHaveBeenCalledWith('/v1/pos/admin/catalog/inventory/adjustments', {
      storeId: 'store-1',
      itemType: 'Product',
      itemId: 'product-1',
      quantityDelta: -2,
      reason: 'Waste',
      note: 'rotura',
      clientOperationId: '98e782d6-0bf6-4dd3-8269-69ecf5345356',
    });
  });

  it('builds list adjustments query params', async () => {
    const getSpy = vi.fn().mockReturnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        PosInventoryAdjustmentsApiService,
        { provide: ApiClient, useValue: { get: getSpy } },
      ],
    });

    const service = TestBed.inject(PosInventoryAdjustmentsApiService);
    await service.listAdjustments({
      storeId: 'store-1',
      itemType: 'Extra',
      itemId: 'extra-1',
      fromUtc: '2026-05-01T00:00:00Z',
      toUtc: '2026-05-02T00:00:00Z',
      reason: 'Correction',
    });

    expect(getSpy).toHaveBeenCalledWith(
      '/v1/pos/admin/catalog/inventory/adjustments?storeId=store-1&itemType=Extra&itemId=extra-1&fromUtc=2026-05-01T00%3A00%3A00Z&toUtc=2026-05-02T00%3A00%3A00Z&reason=Correction',
    );
  });
});
