import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { PosSalesApiService } from './pos-sales-api.service';

describe('PosSalesApiService', () => {
  it('should post sale to /api/v1 path with correlation header', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), PosSalesApiService],
    });

    const service = TestBed.inject(PosSalesApiService);
    const httpMock = TestBed.inject(HttpTestingController);

    const promise = service.createSale(
      {
        clientSaleId: 'sale-id',
        occurredAtUtc: null,
        items: [],
        payment: { method: 'Cash', amount: 10, reference: null },
      },
      'corr-123',
    );

    const req = httpMock.expectOne('/api/v1/pos/sales');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('X-Correlation-Id')).toBe('corr-123');
    req.flush({ saleId: '1', folio: 'POS-1', occurredAtUtc: '2026-02-12T16:04:00Z', total: 10 });

    await promise;
    httpMock.verify();
  });
});
