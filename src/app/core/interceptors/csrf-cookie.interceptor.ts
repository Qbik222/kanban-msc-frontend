import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { environment } from '../../../environments/environment';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  if (!match) {
    return null;
  }
  return decodeURIComponent(match[1].replace(/\+/g, ' '));
}

/**
 * Ensures POST /auth/refresh and /auth/logout send a CSRF header for double-submit.
 * Uses the readable CSRF cookie (default Path=/, name from environment.csrfCookieName).
 * Falls back to AuthService memory (last csrfToken from JSON) only in the same tab when the cookie is not yet readable.
 */
export const csrfCookieInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  if (!req.url.includes('/auth/refresh') && !req.url.includes('/auth/logout')) {
    return next(req);
  }
  if (req.method !== 'POST') {
    return next(req);
  }
  if (req.headers.has('X-XSRF-TOKEN') || req.headers.has('X-CSRF-Token')) {
    return next(req);
  }
  const fromCookie = readCookie(environment.csrfCookieName);
  const fromMemory = auth.getCsrfToken();
  const token = fromCookie ?? fromMemory;
  if (!token) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { 'X-CSRF-Token': token } }));
};
