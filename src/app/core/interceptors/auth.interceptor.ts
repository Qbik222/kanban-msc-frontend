import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, Observable, shareReplay, switchMap, throwError } from 'rxjs';
import { AuthApiService, RefreshResponse } from '../../data/auth-api.service';
import { AuthService } from '../auth/auth.service';

const RETRIED_WITH_REFRESH = new HttpContextToken<boolean>(() => false);

let refreshInFlight$: Observable<RefreshResponse> | null = null;

function isAuthRoute(url: string): boolean {
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/logout')
  );
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const authApi = inject(AuthApiService);
  const router = inject(Router);
  const token = auth.getAccessToken();
  const authRoute = isAuthRoute(req.url);

  const headers: Record<string, string> = {};
  if (token && !authRoute) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const request = req.clone({
    withCredentials: true,
    setHeaders: headers,
  });

  return next(request).pipe(
    catchError((err: HttpErrorResponse) => {
      const retried = req.context.get(RETRIED_WITH_REFRESH);
      const refreshRequest = req.url.includes('/auth/refresh');
      if (err.status !== 401 || authRoute || refreshRequest || retried) {
        return throwError(() => err);
      }

      if (!refreshInFlight$) {
        refreshInFlight$ = authApi.refresh().pipe(
          shareReplay(1),
          finalize(() => {
            refreshInFlight$ = null;
          }),
        );
      }

      return refreshInFlight$.pipe(
        switchMap((tokens) => {
          auth.updateTokens(tokens.accessToken, tokens.csrfToken);
          const refreshedAccess = auth.getAccessToken();
          if (!refreshedAccess) {
            auth.clearSession();
            void router.navigateByUrl('/login');
            return throwError(() => err);
          }
          const retryReq = req.clone({
            withCredentials: true,
            context: req.context.set(RETRIED_WITH_REFRESH, true),
            setHeaders: { Authorization: `Bearer ${refreshedAccess}` },
          });
          return next(retryReq);
        }),
        catchError((refreshErr) => {
          auth.clearSession();
          void router.navigateByUrl('/login');
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};
