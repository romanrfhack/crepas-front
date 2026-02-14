import { HttpInterceptorFn } from '@angular/common/http';

const ACCESS_TOKEN_KEY = 'access_token';
const API_PREFIX = '/api/';
const PUBLIC_API_PATHS = ['/v1/auth/login', '/v1/auth/register', '/v1/auth/refresh'];
const PUBLIC_PREFIXES = ['/health', '/swagger'];
const ALLOWED_API_HOSTS = ['api.cobranzadigital.site', 'localhost', '127.0.0.1'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);

  if (!token || !shouldAttachToken(req.url)) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    }),
  );
};

function shouldAttachToken(url: string): boolean {
  const requestUrl = toUrl(url);
  if (!requestUrl || !isApiRequest(requestUrl, url) || isPublicRoute(requestUrl.pathname)) {
    return false;
  }

  return true;
}

function isApiRequest(requestUrl: URL, rawUrl: string): boolean {
  if (rawUrl.startsWith(API_PREFIX)) {
    return true;
  }

  if (!requestUrl.pathname.startsWith(API_PREFIX)) {
    return false;
  }

  return ALLOWED_API_HOSTS.includes(requestUrl.hostname) || requestUrl.host === window.location.host;
}

function isPublicRoute(pathname: string): boolean {
  if (!pathname.startsWith(API_PREFIX)) {
    return true;
  }

  const apiPath = pathname.slice(API_PREFIX.length - 1);
  return (
    PUBLIC_API_PATHS.some((route) => apiPath.startsWith(route)) ||
    PUBLIC_PREFIXES.some((route) => apiPath.startsWith(route))
  );
}

function toUrl(url: string): URL | null {
  try {
    return new URL(url, window.location.origin);
  } catch {
    return null;
  }
}
