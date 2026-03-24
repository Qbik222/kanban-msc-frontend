/** Empty string: same-origin requests via `ng serve` + proxy.conf.js (no browser CORS to :3500). */
export const environment = {
  production: false,
  apiUrl: '',
  /** Match backend `CSRF_COOKIE_NAME`. Cookie should use `Path=/` (`CSRF_COOKIE_PATH`) so JS can read it on any SPA route. */
  csrfCookieName: 'XSRF-TOKEN',
};
