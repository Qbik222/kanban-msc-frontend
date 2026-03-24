# Kanban frontend (Angular)

## Development server

From this folder:

```bash
npm install
npm start
```

Then open `http://localhost:4200/`. The CLI is available as `npx ng …` if `ng` is not on your PATH.

`npm start` runs `ng serve` with [`proxy.conf.js`](proxy.conf.js): REST and Socket.IO are forwarded to the API on **port 3500**, so the browser talks to **4200 only** (no cross-origin requests to the API in dev). Paths that overlap SPA routes (`/boards`, `/columns`, `/cards`) use a **`bypass`** so full page loads with `Accept: text/html` receive `index.html` instead of the API response.

## Auth and HTTP

- `POST /auth/login` and `POST /auth/register` return `accessToken`, `csrfToken`, and `user`.
- The frontend keeps **`accessToken` and the in-memory `csrfToken` signal** from JSON only in RAM (not in `localStorage` / `sessionStorage`). After a full reload, the CSRF header for refresh/logout comes from the **readable CSRF cookie** (`document.cookie`, name from `environment.csrfCookieName`, default `XSRF-TOKEN`); the backend should set that cookie with **`Path=/`** (`CSRF_COOKIE_PATH`) so it is visible on any SPA route. If the cookie is momentarily unreadable in the same tab, the interceptor falls back to **`csrfToken` still in memory**.
- Refresh token is an **HttpOnly** cookie (typical path `/auth`). The readable CSRF cookie mirrors `csrfToken` for double-submit protection.
- `provideHttpClient` uses **`withXsrfConfiguration`** and **`csrfCookieInterceptor`** so **`X-XSRF-TOKEN`** / **`X-CSRF-Token`** are set on `POST /auth/refresh` and `POST /auth/logout`.
- **`APP_INITIALIZER`** runs a **silent** `POST /auth/refresh` when there is no access token in memory so a full page reload can restore the session if the refresh cookie is still valid.
- Protected requests use `Authorization: Bearer <accessToken>` and `withCredentials: true`.
- On `401`, the auth interceptor performs one refresh attempt, then retries the original request.

## CORS and the API

- **With dev proxy (default):** `environment.ts` uses `apiUrl: ''` so HTTP calls are relative (`/auth`, `/boards`, …). CORS between 4200 and 3500 is not involved for those calls.
- **Direct API URL:** set [`src/environments/environment.ts`](src/environments/environment.ts) to `apiUrl: 'http://localhost:3500'` if you run the app without the proxy; then the backend must allow your SPA origin (see `CORS_ORIGINS` in the API repo and [`docs/frontend.md`](docs/frontend.md)). For cross-origin setups, the readable CSRF cookie must still be available to the SPA origin (shared parent domain, BFF, or same-origin deploy); see `docs/frontend.md`.

After changing backend `CORS_ORIGINS` or `NODE_ENV`, **restart the API** so [`cors-origins.ts`](../backend/src/config/cors-origins.ts) reloads. If the backend `.env.sample` has no CORS lines yet, copy from [`docs/cors-env-append-for-backend.txt`](docs/cors-env-append-for-backend.txt) into the backend repo’s `.env.sample` / `.env`.

## Production build

```bash
npm run build
```

Uses [`environment.prod.ts`](src/environments/environment.prod.ts) (`apiUrl` points at your deployed API; adjust as needed).

## Code scaffolding

Run `npx ng generate component component-name` to generate a new component.

## Tests

```bash
npm test
```

## Further help

[Angular CLI](https://angular.dev/tools/cli)
