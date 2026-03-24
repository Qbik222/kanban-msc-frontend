/** Empty string: same-origin requests via `ng serve` + proxy.conf.json (no browser CORS to :3500). */
export const environment = {
  production: false,
  apiUrl: '',
  /** Must match backend `CSRF_COOKIE_NAME` when using double-submit CSRF (default on Nest side: XSRF-TOKEN). */
  csrfCookieName: 'XSRF-TOKEN',
};
