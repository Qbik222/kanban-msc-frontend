export const environment = {
  production: true,
  apiUrl: 'http://localhost:3500',
  /** Match backend `CSRF_COOKIE_NAME`; CSRF cookie `Path=/` must cover the SPA origin for `document.cookie` after reload. */
  csrfCookieName: 'XSRF-TOKEN',
};
