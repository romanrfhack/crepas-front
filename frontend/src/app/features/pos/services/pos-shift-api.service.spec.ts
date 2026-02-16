import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PosShiftApiService } from './pos-shift-api.service';
import { StoreContextService } from './store-context.service';

describe('PosShiftApiService', () => {
  it('should return null when current shift endpoint responds with 204', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        PosShiftApiService,
        {
          provide: StoreContextService,
          useValue: {
            getActiveStoreId: () => null,
          },
        },
      ],
    });

    const service = TestBed.inject(PosShiftApiService);
    const httpMock = TestBed.inject(HttpTestingController);

    const promise = service.getCurrentShift();

    const req = httpMock.expectOne('/api/v1/pos/shifts/current');
    expect(req.request.method).toBe('GET');
    req.flush(null, { status: 204, statusText: 'No Content' });

    const result = await promise;
    expect(result).toBeNull();
    httpMock.verify();
  });
});
