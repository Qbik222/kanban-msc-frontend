import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../toast/toast.service';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const isAuthRoute =
        req.url.includes('/auth/login') || req.url.includes('/auth/register');
      if (err.status === 401 && !isAuthRoute && auth.getToken()) {
        auth.setToken(null);
        toast.show('Session expired. Please sign in again.', 'error');
        void router.navigateByUrl('/login');
      } else if (err.status === 403) {
        toast.show(err.error?.message ?? 'You do not have permission for this action.', 'error');
      } else if (err.status === 401 && isAuthRoute) {
        toast.show(
          err.error?.message ? String(err.error.message) : 'Invalid credentials',
          'error',
        );
      } else if (err.error?.message) {
        toast.show(String(err.error.message), 'error');
      } else if (err.message && err.status !== 401) {
        toast.show(err.message, 'error');
      }
      return throwError(() => err);
    }),
  );
};
