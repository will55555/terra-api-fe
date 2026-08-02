# terra-api-fe Dev Log

## Phase 2 — TFE-201: Jenkins CI + Same-Origin Deploy Wiring
**Date:** 2026-08-02  **Status:** Complete, live-verified

### Goal
Get this repo's build/test wired into Jenkins, with its `build/` output landing in terra-api's
`src/main/resources/static` before terra-api's own jar is packaged (terra-api-adr-009's
same-origin deploy model) — and along the way, close out the lockfile/dev-compose regression
this repo had been carrying since Phase 1.

### Prerequisite: `phase-1-auth-shell` → `main`
Jenkins builds this repo's `main`, but Phase 1's actual login/JWT work was still sitting unmerged
on its feature branch. Merged (`--no-ff`, no conflicts) before any CI work, so a CI run would
actually validate real functionality instead of the bare pre-Phase-1 scaffold.

### Bug 1: tailwindcss/yaml peer conflict (pre-existing, blocking `npm ci`)
`package-lock.json` had `tailwindcss@3.4.19` resolved as a real, non-optional-looking entry, but
`tailwindcss` isn't in `package.json` at all — it's an **optional peer dependency of
`react-scripts@5.0.1`** (`^3.0.2`, for its built-in Tailwind/PostCSS support). The stale lockfile
had this hoisted in a way that collided with `react-scripts`' own `yaml@1.10.3` pin (tailwindcss
wants `yaml@^2.4.2`). Fixed with `rm -rf node_modules package-lock.json && npm install` — a fresh
resolve correctly **nests** the conflicting `yaml@2.9.0` inside
`node_modules/tailwindcss/node_modules/yaml`, isolated from the top-level `yaml@1.10.3`, instead
of the stale lockfile's colliding hoist. Verified by inspecting both `yaml` entries directly
post-fix, not just "install succeeded."

### Bug 2: typescript floated to an incompatible major (found live, in Docker)
The same lockfile regenerate revealed a second, worse version of the same class of bug — only
visible once actually building in Docker, since the host's `npm ci` didn't hit it the same way
project-side (this became visible via `docker compose up --build`'s `npm ci` step):
`npm ci` failed with `lock file's typescript@7.0.2 does not satisfy typescript@4.9.5`. Nothing in
`package.json` pins `typescript` at all — it's another optional peer dep, this time from both
`react-scripts` (`^3.2.1 || ^4`) and several `@typescript-eslint/*` packages, none of which pin
an exact version. npm's optional-peer auto-install grabbed the newest registry version (`7.0.2`),
which satisfies none of the actual optional ranges. Fixed with an `overrides` block in
`package.json` (`"typescript": "4.9.5"`, the last 4.x release) forcing one consistent resolution
tree-wide, then regenerated the lockfile again. Verified: `node_modules/typescript` resolves to
`4.9.5` post-fix, with the handful of remaining `"7.0.2"` lockfile matches confirmed unrelated
(`react-is@17.0.2`, `rollup-plugin-terser@7.0.2`).

### CI-only `Jenkinsfile` (new, this repo)
Added a standalone `Jenkinsfile` — Checkout → `npm ci` → `npm run build` → `npm test --
--watchAll=false` — no deploy stage, since same-origin deploy means this repo has no independent
deploy target; its `build/` output only ever ships as part of `terra-api`'s jar. Exists purely
for fast, independent CI feedback on every push.

### Jenkins job structure: `-main` / `-branches` split
Rather than one flat multibranch job discovering every branch, both `terra-api-fe` and
`terra-api-be` were split into two jobs each: `<repo>-main` (Filter by name: Include `main`
only) and `<repo>-branches` (Filter by name: Include `*`, Exclude `main`) — organizational
clarity, not a functional requirement (for `terra-api-be`, the existing Jenkinsfile's own
`when { branch ... }` gates still key off `env.BRANCH_NAME` regardless of which job runs a given
branch). Both jobs' "Discover branches" strategy set to plain **"All branches"**, and both had
"Discover pull requests from origin/forks" behaviors deleted — the GitHub App backing
`github-app-terra-api` deliberately lacks `Pull requests: Read` (least-privilege, per TAPI-012),
so any PR-cross-referencing strategy 403s, same as it did the first time this was set up.

### GitHub App scope extension (manual, GitHub-side)
`github-app-terra-api` was originally installed scoped to `terra-api` only (TAPI-012). Since
`terra-api-fe` is a separate repo — not a monorepo subfolder — both the standalone
`terra-api-fe-*` jobs and `terra-api`'s own new "Checkout Frontend" stage (below) need it to also
see `terra-api-fe`. Extended via GitHub → Settings → Installed GitHub Apps → Configure →
Repository access → added `terra-api-fe`.

### terra-api's Jenkinsfile: Checkout/Build/Test/Copy Frontend stages
Added four new stages to `terra-api`'s `Jenkinsfile`, positioned **right after Checkout and
before the gradle Build stage** — not after gradle's Build/Test, where a naive port of the
"frontend stages" placeholder comment would have put them. This ordering is load-bearing: gradle's
`build` packages whatever's currently in `src/main/resources/static` into the jar at build time,
so the frontend has to exist there *before* gradle runs, not after.
- **Checkout Frontend** — `git` checkout of `terra-api-fe`'s `main` into a `terra-api-fe/`
  subdirectory of the workspace, using the same `github-app-terra-api` credential. Always builds
  `main` regardless of which `terra-api` branch is building — the two repos' branches don't
  correspond 1:1, so branch-name-matching would fail more often than it'd succeed.
- **Build Frontend** — `npm ci && npm run build` (not `npm install` — reproducible, and would
  have caught both lockfile bugs above at CI time instead of at a live build).
- **Test Frontend** — `npm test -- --watchAll=false` (react-scripts defaults to watch mode,
  which would hang the pipeline indefinitely without this flag).
- **Copy Frontend Build** — clears `src/main/resources/static`, then copies `terra-api-fe/build/*`
  into it, so gradle's subsequent `Build` stage packages the frontend into the same jar.

Also dropped the unused `FRONTEND_IMAGE` Jenkins env var — there's no separate frontend Docker
image in the same-origin model, so it was dead weight left over from an earlier assumption.

### Live verification
- `terra-api-fe-main` build #1: full green — Checkout, `npm ci && npm run build`, `npm test`
  (1/1 passing, same test verified locally in Phase 1) all passed in a clean Jenkins agent
  environment, not just on a dev machine with a warm `node_modules` cache.
- `terra-api`'s `phase-7-frontend-ci-integration` build #2: the real end-to-end test of TFE-201
  itself — Checkout SCM → Checkout → **Checkout Frontend** (3s, confirming the GitHub App scope
  extension worked, no 403) → **Build Frontend** (3m22s) → **Test Frontend** (17s) → **Copy
  Frontend Build** (1s) → gradle Build → gradle Test → Build Docker Image → Push to Docker Hub →
  Deploy to Staging (manual approval, then a real deploy) → Deploy to Prod correctly skipped
  (not `master`) → Post Actions. All green. One transient failure along the way: a Docker-build-stage
  DNS resolution failure reaching Maven Central (`Temporary failure in name resolution`) — every
  dependency failed identically, the signature of a network blip rather than a real dependency
  problem; confirmed DNS was healthy moments later from both the host and a fresh container, and
  a plain re-run succeeded.

### Known Limitations / Next
Phase 3 (backend health/entitlement/role-claim work) and Phase 4 (visualizer integration) are
next — see `TASKS.md`.

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
