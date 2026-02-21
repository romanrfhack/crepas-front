import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../../features/auth/services/auth.service';
import { PlatformTenantContextService } from '../../features/platform/services/platform-tenant-context.service';

const POS_ADMIN_PATH = '/api/v1/pos/admin/';
const SNAPSHOT_PATH = '/api/v1/pos/catalog/snapshot';
const PLATFORM_PATH = '/api/v1/platform/';

export const platformTenantInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const tenantContext = inject(PlatformTenantContextService);

  if (!authService.hasRole('SuperAdmin')) {
    return next(req);
  }

  const tenantId = tenantContext.getSelectedTenantId();
  if (!tenantId) {
    return next(req);
  }

  const requestUrl = new URL(req.url, window.location.origin);
  const path = requestUrl.pathname;
  const isPosAdminRequest = path.startsWith(POS_ADMIN_PATH) || path === SNAPSHOT_PATH;
  const isPlatformRequest = path.startsWith(PLATFORM_PATH);

  if (!isPosAdminRequest || isPlatformRequest) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { 'X-Tenant-Id': tenantId } }));
};
