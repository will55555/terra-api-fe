# terra-api-fe Dev Log

## Phase 1 — Auth Shell
**Date:** 2026-08-01  **Status:** Complete

### Goal
Stand up login + route-gating plumbing (TFE-101/102/103) against terra-api's already-live
JWT auth (ADR-003), so later phases have somewhere to attach real product UI behind a login wall.

### Key Design Decision
JWT stored in `localStorage` (not an httpOnly cookie) — matches the backend's current
JSON-body token response with zero backend changes; accepted XSS-exposure tradeoff since the
app has no other user-generated-content surface yet. `authFetch()` added proactively so
Phase 3/4 API calls don't each have to remember to attach the `Authorization` header.
No signup flow built — confirmed via `AuthService.java` that terra-api validates against a
single hardcoded service-account credential (`TerraAuthProperties`), no user database exists.
Real per-customer accounts are gated behind ADR-003's Issuer Model trigger and ADR-011's
`customer_service_access` table (Phase 3 backend work, not yet built) — noted in `TASKS.md`.

### Files Created / Modified
- `.env.development` — left unset on purpose (see CORS error below); only needed to override
  toward a non-local backend
- `package.json` — `"proxy": "http://localhost:8081"` (CRA dev-server proxy, see CORS error below)
- `src/config/apiConfig.js` — reads `REACT_APP_API_BASE_URL`, defaults to a relative empty
  string so requests are same-origin in both dev (via the proxy) and prod
- `src/services/authService.js` — `login`/`logout`/`getToken`/`isAuthenticated`/`authFetch`
- `src/context/AuthContext.js` — React context wrapping the service
- `src/components/ProtectedRoute.js` — redirects unauthenticated users to `/login`
- `src/pages/Login.js` — plain unstyled login form (Phase 1 is plumbing, not the Concept AB
  design — that's Phase 4)
- `src/App.js` — wires up `react-router-dom` (`/login` public, `/` protected), replaces the
  untouched CRA boilerplate
- `src/App.test.js` — replaced the stale "renders learn react link" boilerplate test with a
  real smoke test asserting unauthenticated `/` redirects to the login page

### Error — bodyless 401 breaks a JSON-parsing error handler
**Where:** `authService.js`'s `login()`, failure branch
**Root cause:** an interim version did `const { error } = await response.json(); throw new
Error(error);` on a failed login, but `terra-api`'s `AuthController.login()` returns
`ResponseEntity.status(401).build()` with **no response body** — `response.json()` on an
empty body throws `SyntaxError: Unexpected end of JSON input`, so every failed login attempt
(the primary failure path, not an edge case) would have surfaced a confusing parse error
instead of a clean message.
**Fix:** switched to `throw new Error("Login failed: " + response.statusText)`, which never
touches the response body.
**Why not the backend-side fix:** also considered having `AuthController` return a real JSON
error body on 401 so the frontend could show a backend-authored message — deferred since it's
a `terra-api` change, out of this phase's scope; revisit if a nicer end-user message matters later.

### Error — CORS blocked login in local dev
**Where:** `authService.js`'s `login()`, browser fetch to `terra-api` from the CRA dev server
**Full error:** `Access to fetch at 'http://localhost:8081/api/auth/login' from origin
'http://localhost:3000' has been blocked by CORS policy: Response to preflight request
doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present`
**Root cause:** `terra-api` has zero CORS configuration (confirmed — no
`CorsConfigurationSource` anywhere), by design per ADR-009: production serves the frontend
same-origin, so CORS was deliberately never built. Local dev genuinely is cross-origin
(`:3000` → `:8081`), which a same-origin-only backend can't satisfy.
**Fix:** CRA's `"proxy": "http://localhost:8081"` (`package.json`) + `apiConfig.js` defaulting
to a relative (empty) base URL instead of an absolute dev URL. The dev server now proxies
`/api/*` server-side, so the browser never makes a cross-origin request at all — matches
production's real same-origin shape instead of introducing a different cross-origin path
just for dev.
**Why not backend CORS config:** would work, but adds a permissive surface to `terra-api`
that ADR-009 explicitly chose to avoid by going same-origin; the proxy approach needed zero
backend changes and made dev and prod behave the same way instead of differently.
**Verified live:** logged in with the configured `TERRA_AUTH_USERNAME`/`PASSWORD` credential,
redirected to `/`, `ProtectedRoute` rendered the Dashboard placeholder — full Phase 1 flow
confirmed end-to-end in a real browser.

### Build / Test Result
`npm test -- --watchAll=false` — 1/1 passing (`App.test.js`), confirmed by Will.

### Known Limitations / Next
No signup UI (by design, see above). Phase 2 (same-origin Jenkins deploy wiring) and Phase 4
(Command Matrix dashboard, Nkap tier cards, visualizer) are the next real feature work — see
`TASKS.md`. Separately, the repo's existing lockfile/dev-compose regression (unrelated to this
phase — that's about Docker integration, not local `npm test`) is still open.
