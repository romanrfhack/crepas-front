import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  CanMatchFn,
  Route,
  Router,
  RouterStateSnapshot,
  UrlSegment,
} from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/services/auth.service';

const DASHBOARD_URL = ['/app/dashboard'];

const hasLegacyInventoryAccess = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  if (environment.legacyInventoryEnabled || authService.hasRole('SuperAdmin')) {
    return true;
  }

  return router.createUrlTree(DASHBOARD_URL);
};

export const legacyInventoryGuard: CanMatchFn & CanActivateFn = ((
  route: Route | ActivatedRouteSnapshot,
  stateOrSegments?: RouterStateSnapshot | UrlSegment[],
) => {
  void route;
  void stateOrSegments;
  return hasLegacyInventoryAccess();
}) as CanMatchFn & CanActivateFn;
