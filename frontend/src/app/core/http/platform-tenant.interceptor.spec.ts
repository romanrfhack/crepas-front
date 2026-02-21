import { HttpEvent, HttpHandlerFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { AuthService } from '../../features/auth/services/auth.service';
import { PlatformTenantContextService } from '../../features/platform/services/platform-tenant-context.service';
import { platformTenantInterceptor } from './platform-tenant.interceptor';

describe('platformTenantInterceptor', () => {
  const run = (url: string, authRoles: string[], tenantId: string | null) => {
    const authMock = { hasRole: (role: string) => authRoles.includes(role) } as Pick<AuthService, 'hasRole'>;
    const tenantMock = { getSelectedTenantId: () => tenantId } as Pick<PlatformTenantContextService, 'getSelectedTenantId'>;
    let captured: HttpRequest<unknown> | null = null;

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authMock },
        { provide: PlatformTenantContextService, useValue: tenantMock },
      ],
    });

    TestBed.runInInjectionContext(() => {
      const req = new HttpRequest('GET', url);
      const next: HttpHandlerFn = (request): Observable<HttpEvent<unknown>> => {
        captured = request;
        return of(new HttpResponse({ status: 200 }));
      };
      platformTenantInterceptor(req, next).subscribe();
    });

    return captured;
  };

  it('adds X-Tenant-Id for super admin pos admin requests', () => {
    const req = run('/api/v1/pos/admin/catalog/overrides', ['SuperAdmin'], 'tenant-1') as unknown as HttpRequest<unknown>;
    expect(req.headers.get('X-Tenant-Id')).toBe('tenant-1');
  });

  it('does not add header for platform requests', () => {
    const req = run('/api/v1/platform/catalog-templates', ['SuperAdmin'], 'tenant-1') as unknown as HttpRequest<unknown>;
    expect(req.headers.has('X-Tenant-Id')).toBe(false);
  });

  it('does not add header when user is not super admin', () => {
    const req = run('/api/v1/pos/admin/catalog/overrides', ['Admin'], 'tenant-1') as unknown as HttpRequest<unknown>;
    expect(req.headers.has('X-Tenant-Id')).toBe(false);
  });
});
