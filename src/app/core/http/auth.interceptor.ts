import { HttpInterceptorFn } from '@angular/common/http';

const ACCESS_TOKEN_KEY = 'access_token';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);

  // Si aún no hay token (por ejemplo login), dejamos pasar
  if (!token) return next(req);

  const authReq = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` }
  });

  return next(authReq);
};
