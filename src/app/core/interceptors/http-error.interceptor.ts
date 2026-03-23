import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../toast/toast.service';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const isAuthRoute =
        req.url.includes('/auth/login') || req.url.includes('/auth/register');
      if (err.status === 403) {
        toast.show(err.error?.message ?? 'You do not have permission for this action.', 'error');
      } else if (err.status === 401 && isAuthRoute) {
        toast.show(
          err.error?.message ? String(err.error.message) : 'Invalid credentials',
          'error',
        );
      } else if (err.error?.message && err.status !== 401) {
        toast.show(String(err.error.message), 'error');
      } else if (err.message && err.status !== 401) {
        toast.show(err.message, 'error');
      }
      return throwError(() => err);
    }),
  );
};
