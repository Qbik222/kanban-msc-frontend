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
      const isRefreshOrLogout = req.url.includes('/auth/refresh') || req.url.includes('/auth/logout');
      if (err.status === 403) {
        toast.show(err.error?.message ?? 'You do not have permission for this action.', 'error');
      } else if (err.status === 401 && isAuthRoute) {
        toast.show(
          err.error?.message ? String(err.error.message) : 'Invalid credentials',
          'error',
        );
      } else if (err.status === 401 && !isRefreshOrLogout) {
        // For private API 401 responses, clear local auth state and force public navigation.
        auth.clearSession();
        void router.navigateByUrl('/login');
      } else if (err.error?.message && err.status !== 401) {
        toast.show(String(err.error.message), 'error');
      } else if (err.message && err.status !== 401) {
        toast.show(err.message, 'error');
      }
      return throwError(() => err);
    }),
  );
};
