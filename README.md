# Kanban frontend (Angular)

## Development server

From this folder:

```bash
npm install
npm start
```

Then open `http://localhost:4200/`. The CLI is available as `npx ng …` if `ng` is not on your PATH.

`npm start` runs `ng serve` with [`proxy.conf.json`](proxy.conf.json): REST and Socket.IO are forwarded to the API on **port 3500**, so the browser talks to **4200 only** (no cross-origin requests to the API in dev).

## Auth Flow (Cookie Refresh + Bearer Access)

- `POST /auth/login` and `POST /auth/register` return `accessToken`, `csrfToken`, and `user`.
- The frontend keeps `accessToken` and `csrfToken` in memory only (no `localStorage` persistence).
- Refresh token is managed by backend as HttpOnly cookie (`/auth` path) and is not readable by JS.
- Protected requests use:
  - `Authorization: Bearer <accessToken>`
  - `withCredentials: true`
- On `401`, interceptor performs one refresh attempt via `POST /auth/refresh` with header `X-CSRF-Token`, then retries the original request.
- `POST /auth/logout` also requires `X-CSRF-Token` and `withCredentials: true`.
- With the current backend contract, session is not restored after full page reload unless user signs in again (CSRF exists only in response body, not in readable cookie).

## CORS and the API

- **With dev proxy (default):** `environment.ts` uses `apiUrl: ''` so HTTP calls are relative (`/auth`, `/boards`, …). CORS between 4200 and 3500 is not involved for those calls.
- **Direct API URL:** set [`src/environments/environment.ts`](src/environments/environment.ts) to `apiUrl: 'http://localhost:3500'` if you run the app without the proxy; then the backend must allow your SPA origin (see `CORS_ORIGINS` in the API repo and [`docs/frontend.md`](docs/frontend.md)).

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
