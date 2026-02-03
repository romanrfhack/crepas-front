import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        console.error('[HTTP ERROR]', {
          method: req.method,
          url: req.url,
          status: err.status,
          message: err.message,
          error: err.error
        });
      } else {
        console.error('[UNKNOWN ERROR]', err);
      }
      return throwError(() => err);
    })
  );
