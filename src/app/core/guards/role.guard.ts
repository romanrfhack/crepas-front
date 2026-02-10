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
import { AuthService } from '../../features/auth/services/auth.service';

const DASHBOARD_URL = ['/app/dashboard'];

type GuardRoute = Route | ActivatedRouteSnapshot;

const resolveRequiredRoles = (route: GuardRoute, fallback: readonly string[]) => {
  const routeRoles = route.data?.['roles'];
  if (Array.isArray(routeRoles)) {
    return routeRoles.filter((role): role is string => typeof role === 'string');
  }

  return [...fallback];
};

const evaluateRoleAccess = (route: GuardRoute, requiredRoles: readonly string[]) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  const roles = resolveRequiredRoles(route, requiredRoles);
  if (roles.length === 0 || authService.hasAnyRole(roles)) {
    return true;
  }

  return router.createUrlTree(DASHBOARD_URL);
};

export const roleGuard = (requiredRoles: readonly string[] = []): CanMatchFn & CanActivateFn => {
  const canMatch: CanMatchFn = (route: Route) => evaluateRoleAccess(route, requiredRoles);
  const canActivate: CanActivateFn = (
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ) => {
    void state;
    return evaluateRoleAccess(route, requiredRoles);
  };

  return ((route: Route | ActivatedRouteSnapshot, segments?: UrlSegment[]) => {
    if (segments) {
      return canMatch(route as Route, segments);
    }

    return canActivate(route as ActivatedRouteSnapshot, {} as RouterStateSnapshot);
  }) as CanMatchFn & CanActivateFn;
};
