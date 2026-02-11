import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { GlobalErrorService } from '../services/global-error.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: unknown) => {
      const globalErrorService = inject(GlobalErrorService);
      if (err instanceof HttpErrorResponse) {
        console.error('[HTTP ERROR]', {
          method: req.method,
          url: req.url,
          status: err.status,
          message: err.message,
          error: err.error,
        });
        if (err.status === 0 || err.status === 500) {
          globalErrorService.setMessage(
            'Tuvimos un problema al procesar tu solicitud. Intenta nuevamente en unos minutos.',
          );
        }
      } else {
        console.error('[UNKNOWN ERROR]', err);
      }
      return throwError(() => err);
    }),
  );
