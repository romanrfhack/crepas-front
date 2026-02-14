import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('adds Authorization header for relative protected API routes', () => {
    localStorage.setItem('access_token', 'token-value');

    httpClient.get('/api/v1/admin/users').subscribe();

    const req = httpMock.expectOne('/api/v1/admin/users');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-value');
    req.flush({});
  });

  it('adds Authorization header for absolute protected API routes on production host', () => {
    localStorage.setItem('access_token', 'token-value');

    httpClient.get('https://api.cobranzadigital.site/api/v1/admin/users').subscribe();

    const req = httpMock.expectOne('https://api.cobranzadigital.site/api/v1/admin/users');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-value');
    req.flush({});
  });

  it('does not add Authorization header for login route', () => {
    localStorage.setItem('access_token', 'token-value');

    httpClient.post('/api/v1/auth/login', {}).subscribe();

    const req = httpMock.expectOne('/api/v1/auth/login');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });
});
