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

## Phase 4 rework — TFE-401 visualizer: full phase5 copy-paste port + dashboard restyle
**Date:** 2026-08-04  **Status:** Complete, live-verified in Docker dev; NOT yet committed

### Goal
Two threads, both on `solan`: (1) close TAPI-017's open ⚠️ (the operator page had never
actually been rendered against live data), and (2) rebuild the customer visualizer — the
existing `terraScene.js` was a deliberately *reduced* port of
`terra-hq-site/terra_api_visualizer_phase5.js` (462 lines vs. phase5's 1,630), and Will's
explicit call was that this was wrong: he wanted full parity, not a smaller dashboard-card
variant.

### TAPI-017 verification
`/internal` confirmed rendering live (lattice + "NO SERVICES YET" empty state, correct given
neither ROMS nor PIOS reports a heartbeat). Backend test suite green, 26 tests including
`SecurityPathsTest`.

### Infra prerequisite: port 8082 unreachable when containerized
`application.yaml`'s `management.server.address: localhost` bound Tomcat to the CONTAINER's own
loopback — Docker's host port-forward (`0.0.0.0:8082->8082`) had nothing to connect to. Tomcat's
own logs said "started on 8082"; `curl` from the host got "Empty reply from server." Fixed via
`${MANAGEMENT_ADDRESS:localhost}` (default unchanged) + `MANAGEMENT_ADDRESS: 0.0.0.0` set only
in `docker-compose.dev.yml`'s environment block for the containerized `terra-api-be` service.

### terraScene.js: full copy-paste port of phase5
Rewrote `terraScene.js` to preserve everything phase5 has that the earlier reduced version
dropped: starfield, glass/gem `MeshPhysicalMaterial` (transmission/ior/roughness tuned for a
sapphire look — confirmed by Will as deliberately Infinity-Stone-like, not a bug), the full
click-to-expand/release/collapse three-state machine per cube, pipeline tubes with a custom
GLSL shader (gold pulse when connected, red when not), the mouse-repulsion field, touch support.
Kept from the earlier React port (necessary adaptations, not scope cuts): no module-level
mutable state (StrictMode double-invoke safety), canvas via React ref not `getElementById`,
health fed in via `applyHealth()` not an internal fetch loop, listeners on the canvas element
not `window`, theme via `setTheme()` not an internal localStorage toggle.

### 3 real bugs found and fixed during/after the port
1. **Tubes visually detached from cubes.** phase5's per-frame `cube.position.x = originalPos.x +
   Math.sin(time * speed) * 0.3` sine-drift moved domain cubes every frame, but the main radial
   pipeline tubes are built ONCE from a static `LineCurve3` between cube centres and never
   redrawn — so the tube only touched its cube at the instant `sin()` crossed zero. Present in
   phase5's own source too, not introduced by the port. Fixed by dropping the drift entirely —
   also removes a fight with click-to-expand, which sets `cube.position` directly.
2. **Root cause of "some children aren't there" (Will's exact words, confirmed via
   screenshot — Finance/Hospitality/Ventures worked, the other 5 domains didn't):** 5 of 8
   placeholder child cubes in `domainConfig.js` had `service.name` set to the literal SAME
   string as their parent `domain.name` (e.g. domain `'Real Estate'`, child `service: { name:
   'Real Estate' }`). `buildCubeConfig()` pushes both into one flat array; `terraScene.js`'s
   `cubesByName` keys meshes by that `name` — so the domain shell and its child collided on one
   map key, and only the most-recently-created mesh was ever reachable via lookup (used by
   click handling, health colouring, tube endpoints). Finance/Hospitality/Ventures (children
   Nkap/ROMS/PIOS) already had distinct names, which is exactly why only those three "almost"
   worked. Fixed: renamed all 5 colliding children to `<Domain> (Planned)`. Verified afterward —
   all 17 cube names (1 anchor + 8 domains + 8 children) now unique, zero collisions.
3. **Anchor never turned pink when the backend was unreachable.** phase5's own
   `createSapphireCube` already specifies `0xaa8899` ("Terra: greyish pink when disconnected")
   for the anchor — but that branch only runs at MESH-CREATION time, and the anchor is always
   built `connected: true`, so the pink value was dead code even in the port. The actual "off"
   state ran through `updateCubeConnection()`, which only ever touched opacity/emissive/edges,
   never the base `material.color`. Separately, `applyHealth`'s own reachability check
   (`statusByServiceId != null`) was structurally always `true` — `EcosystemVisualizer` defaults
   the prop to `{}`, never `null`, and the hook's own state stays `{}` on a fetch failure by
   design (so a transient blip doesn't blank the topology). Fixed both: `updateCubeConnection`
   now swaps the anchor's body colour between white/pink based on connection state, and
   `applyHealth` takes an explicit `hasError` parameter threaded from the hook's real `error`
   value (`EcosystemVisualizer.js` → `applyHealth(statusByServiceId, Boolean(error))`).

### Also fixed, found live via screenshot
- Unbuilt-service children (6 of 8, no real `serviceId`) were functionally invisible once
  expanded — `updateCubeConnection`'s disconnected state dropped opacity to 0.7 AND removed the
  edge-outline `LineSegments` entirely. Against the dark scene background that read as "gone,"
  not "dim." Fixed: edge outlines now stay attached regardless of connection state; only their
  own opacity changes (100% connected, 35% disconnected). Body opacity floor raised 0.7 → 0.55
  to compensate. `UNBUILT_COLOR`/`OFF_COLOR` hue values themselves untouched.
- Expand/scatter distance (`2.0`, phase5's original, tuned for a full-viewport scene) sent cubes
  flying off the bounded dashboard card, dragging visibly-stretched tubes with them. Reduced to
  `0.8` for both `expandDistance` and `scatterDistance`.
- Idle auto-rotation added — **confirmed absent in phase5's own source** (grepped directly, no
  `autoRotate` anywhere), so this is a genuine addition beyond a faithful port, not a
  restoration. The hint text ("DRAG TO ROTATE · DOUBLE-CLICK TO RESUME SPIN") had been promising
  it since an earlier, different version of this component that DID have it — Will confirmed he
  wants it, so it's real now: slow idle spin, stops on drag, resumes on double-click.

### Tier colour contrast fix (explicit, scoped exception to the colours-frozen rule)
`healthColors.js`: `ORANGE` `0xfb923c → 0xe8590c` (was only ~20° from `YELLOW` on the hue wheel,
visually indistinguishable at cube scale — confirmed via `?mockHealthAll=1` screenshot) and
`RED` `0xf87171 → 0xdc2626` (was a desaturated salmon that read as pink, not red, once the glass
material's highlights sat on top of it). Both changes were explicitly requested by Will in the
moment, after seeing the actual rendered result — not a general repaint. `HEALTHY`/`YELLOW`
left untouched.

### Dev-only test tooling — added and kept permanently, not scaffolding
Neither ROMS nor PIOS reports a real heartbeat yet, so there was no way to visually verify
tier colours/pulse/auto-rotation without synthetic data. `useEcosystemHealth.js` gained an
opt-in override via URL query param (`?mockHealth=1` for ROMS/PIOS only, matching what
production actually maps; `?mockHealthAll=1` for all 8 domains with one OFF and the rest cycled
across all 4 real tiers). `terraScene.js` has a matching, equally opt-in override for
`SERVICE_ID_BY_CUBE_NAME` (production only maps ROMS/PIOS by design — the `mockHealthAll` case
needs all 8 domains eligible). Neither override activates without the query param; every normal
page load runs the real fetch/poll unmodified. Framed explicitly as permanent test tooling to
keep using, not "temporary, delete me" scaffolding — it stays useful for testing tiers that
haven't happened in production yet, indefinitely.

### Dashboard restyle — Montfort Group (mont-fort.com) as structural reference
Will fed the actual HTML markup from Montfort's site as a design reference, scoped explicitly to
structure/spacing only — Terra's existing gold/mono-terminal palette and typography stay
untouched, consistent with the colours-frozen rule.
`dashboard.css` / `Dashboard.js` changes: `.cm-grid` gap `28px → 40px` and `max-width`
`1400px → 1700px` (cards now stretch closer to viewport edges); `.cm-card` padding
`26px → 34px`; new `.cm-card-index` numbered badge (`01`/`02`/`03`) added before each section's
`// LABEL` title, mirroring Montfort's numbered division list; corner ornaments
(`.cm-corner`) reshaped from angular low-poly triangle bevels (`clip-path: polygon(...)`) to a
soft quarter-circle `radial-gradient` glow at lower opacity — Will's own framing was that the
triangular version "looks too much like a game," a reaction his younger brother had
independently; base font `11px → 13px`, smallest labels `8/9px → 9/10px`; `--text-dim`/
`--text-muted` brightened (`#7a7570 → #a39d95`, `#4a4744 → #6b655f`) for readability at the new
smaller-but-still-small type scale; light-mode `--border-sub` alpha `0.08 → 0.18` (card edges
were barely visible against `--surface` in light mode). `visualizer.css`: aspect-ratio settled
at `3/2` (between the original `16/10` and an interim `4/3` overcorrection — the "too large"
report turned out to be a browser-zoom artefact on Will's end, not the real render) with a new
`max-height: 460px` — needed once discovered the `/internal` operator page hosts the same
component in a FULL-width card (no 60/40 split like the customer dashboard), where an uncapped
aspect-ratio alone produced a ~930px-tall card.

### Docker Compose project scoping (infra, not code)
Rebuilding the stack repeatedly surfaced that some earlier invocations (run without an explicit
`-p` flag, from inside `terra-api/` rather than `terra-api-home/`) had created containers under
project name `terra-api`, while later invocations from `terra-api-home/` used the implicit
`terra-api-home` project — two separate Compose projects fighting over the same container names
(`redis`, `postgres`). Root cause: neither `docker-compose.yml` sets an explicit `name:` field,
so Compose infers the project name from the first `-f` file's directory when using explicit `-f`
flags (as opposed to the root file's `include:` mechanism, which does set it correctly). Fixed
by always invoking with `-p terra-api-home` explicitly. `terra-jenkins`/`infra_jenkins_home`
(the volume TAPI-019 needs intact) was checked and confirmed untouched before every destructive
`docker rm`/`down -v` this session.

### Known Limitations / Next
terra-hq-site was explicitly deferred to a fresh session (Will's call, given this session's
length) — same Montfort structural pass (whitespace, numbered sections) plus a second pattern
identified from Montfort's markup: in-page anchor-tab navigation paired with an animated
scroll-reveal transition, rather than an instant `#anchor` jump. TFE-502/503 (401 redirect UX,
10/12 modules untested) remain open from prior sessions, untouched here. Nothing in this entry
has been committed — 8 files modified in `terra-api-fe`, 2 in `terra-api` (`application.yaml`,
`docker-compose.dev.yml`), plus a regenerated `package-lock.json` (fixed a stale
`react-router`/`react-router-dom` version mismatch and a `caniuse-lite` gap that broke the
Docker build's PostCSS step — unrelated pre-existing issue, found while rebuilding for this
work).

## Refinement Notes — Future Product Pass
**Date:** 2026-08-06  **Status:** Captured for later refinement work

The next product-phase pass should treat the current dashboard and login experience as a first
implementation rather than the final UX. The planned refinement direction is:
- redesign the dashboard layout so it feels less like a single dense page and more like a guided
  product surface with clearer hierarchy, spacing, and information grouping;
- redesign the login experience to feel more polished and intentional, including stronger visual
  focus, clearer affordances, and a more deliberate handoff back to the destination the user was
  trying to reach;
- replace the current one-page flow with navigable sections or tabs so users can move between
  major areas of the product without feeling trapped in a single long screen;
- keep this as a dedicated refinement/improvement phase rather than folding it into the current
  functional implementation work, so visual polish and information architecture can evolve
  independently from core behavior.

These items should be carried forward as UX refinement tasks for the next design pass.

## Deploy Status Correction + Jenkinsfile Cleanup Stage + Webhook Payload URL
**Date:** 2026-08-08  **Status:** Complete

### Goal
Resolve a stale HUB_STATE note ("not production-ready") that had been carrying since TFE-401,
add a post-build cleanup stage to this repo's Jenkinsfile matching terra-api's own disk-cleanup
standing rule, and identify the correct GitHub webhook payload URL for push-triggered builds.

### Deploy status was stale, not accurate
HUB_STATE's terra-api-fe section read "Feature-complete... but still NOT production-ready (only
ever run via Docker dev compose / CRA dev server, no real ROMS/PIOS deployment to test
against)." That conflated two different things: whether this repo has ever been *deployed*
(false — it has, since TFE-201/2026-08-02) with whether it's been *integration-tested* against
real ROMS/PIOS data (true — it hasn't). Verified live via
`curl -sI https://api.terra-hq.com/` returning a real CRA build shell
(`<script defer src="/static/js/main.054491d5.js">`), `Last-Modified` same-day — confirms
same-origin embed (adr-009) has been shipping this repo's build output inside terra-api's own
jar the entire time via terra-api's Jenkinsfile "Checkout/Build/Test/Copy Frontend" stages, not
a separate undeployed pipeline. HUB_STATE corrected same session.

### Jenkinsfile cleanup stage — landed on `npm cache verify`, not `clean --force`
terra-api's own Jenkinsfile runs `docker image prune -f` in a `post { always {} }` block —
part of the hub's standing "CI/CD Disk Cleanup — Design-Time, Not Retrofit" rule (from the
2026-08-08 ROMS disk-fill incident). This repo's pipeline has no Docker build at all (same-origin
deploy — terra-api's own pipeline ships the build output, not this repo's), so `docker image
prune` had nothing to target here.

**First attempt:** `npm cache clean --force`, matching the *shape* of terra-api's rule
(unconditional, in `post { always {} }`). Reconsidered after Will flagged the speed cost — a full
wipe on every build throws away cache the *next* `npm ci` would have reused, for no
corresponding benefit.

**Why not a size-threshold gate either:** considered gating the clean behind a `du`-based MB
threshold (only clean when cache exceeds some size). Rejected — the hub's standing disk-cleanup
rule is *deliberately* unconditional specifically because gradual silent accumulation was the
actual failure mode in the ROMS incident (a threshold that's never checked or never crossed
reproduces exactly that blind spot). But that rule was written for Docker image layers, which do
genuinely leak disk space across builds — npm's cache is content-addressed and self-managing, so
it doesn't have Docker's unbounded-growth problem in the first place. Neither the unconditional
wipe nor a threshold gate was solving a real problem for npm specifically.

**Final:** `npm cache verify` — prunes corrupted/unreachable cache entries only, keeps everything
reusable. Matches the actual risk profile (corruption, not unbounded growth) instead of importing
Docker's cleanup pattern wholesale. Commits: `813959a` (clean --force, superseded), `8b9ae71`
(final verify version).

### GitHub webhook payload URL identified
terra-api-fe uses Jenkins multibranch jobs (`terra-api-fe-main` / `terra-api-fe-branches`,
discovered via the `github-app-terra-api` GitHub App — see Phase 2 above). The payload URL is
the same single global receiver terra-api's own SonarQube-triggered webhook already uses on the
shared `terra-jenkins` instance: `http://3.211.62.86:8090/github-webhook/` (content type
`application/json`, "Just the push event") — Jenkins dispatches to whichever job matches the
incoming repo, so this is not a per-repo path.

### Known Limitations / Next
- Webhook payload URL identified but not yet confirmed added to the GitHub repo settings, and
  not yet confirmed that `terra-api-fe-main`/`-branches` jobs have "GitHub hook trigger for
  GITScm polling" enabled (may still be relying on periodic scan instead of push-triggered
  builds — same gap terra-api itself had before its SonarQube work added the webhook).

## Terra API Internal Surface — HTML-to-React Port, /internal (ApiDashboard), Root Route Swap
**Date:** 2026-08-09  **Status:** Complete, build-verified, NOT yet browser-verified on a real
mobile device (see Known Limitations) — everything else confirmed via `CI=true npx react-scripts
build` after every change and, where noted, a live screenshot comparison against the HTML source.

### Goal
terra-hq-site's `terra_api_strategy.html` — a static, 1048-line, self-contained HTML file
covering Terra API's own "what is this service" documentation (8 tabs: Overview, Core Services,
Health & Isolation, Build Sequence, ADRs, Ecosystem (Public), Ecosystem Architecture, For
Partners) — needed to become a real page inside this app, at `/internal` initially (later moved
to `/`, see the last section below). The HTML file itself stays in terra-hq-site as a frozen
local reference copy, not kept in hand-maintained sync going forward. Separately, the existing
standalone `/internal` operator surface (`OperatorDashboard.js` — live ecosystem-health
visualizer + service table, terra-api-adr-012) needed folding into this same page as a tab,
rather than staying a second top-level route.

This encompasses several genuinely distinct pieces of work, documented in the order they
actually happened (including the mistakes, since the corrections are as instructive as the
final state):

1. Scaffold a new `/internal` route reusing the existing `OperatorRoute` auth gate.
2. Migrate `OperatorDashboard.js` into a tab (`OperatorTab.js`) inside the new page, delete the
   old standalone route.
3. Port the HTML's animated circuit-board canvas backdrop (`HeartbeatBackdrop.js`) — code, not
   just an image.
4. **A full redo of steps 1-3's visual layer** — the first pass had drifted through this app's
   existing shared CSS tokens instead of copying the HTML's actual values, and Will caught it.
5. A chain of small, real bugs found only by Will actually looking at the rendered page: light-
   mode tab-bar color, an opaque visualizer background, a washed-out dark-mode hero, a body
   background bug that had nothing to do with the circuit canvas itself, a CSS specificity tie
   silently losing to an unrelated stylesheet.
6. UI additions with no HTML equivalent: a mobile/always-visible hamburger menu + drawer, a
   logo placeholder, removing a badge.
7. Moving the whole page from `/internal` to `/` — the app's new default landing route.

---

### 1-2. Scaffolding + folding OperatorDashboard in as a tab

`OperatorRoute.js` already existed (role=internal + ops:read gate, terra-api-adr-012) and is
generic — no changes needed to reuse it for a second page. `ApiDashboard.js` was created fresh
with 8 tab IDs (`overview`, `core-services`, `health-isolation`, `build-sequence`, `adrs`,
`ecosystem-public`, `ecosystem-architecture`, `for-partners`), each initially rendering a
separate component file under `src/internal/api/`.

Once Will confirmed both `/internal` (old OperatorDashboard) and the new page shared exactly one
audience (role=internal), `OperatorDashboard.js`'s body (the ecosystem-health `EcosystemVisualizer`
+ `OperatorServiceTable`, plus its `forbidden`/403 handling and tier-accent `useEffect`) was
lifted verbatim into a new `OperatorTab.js`, added as a 9th tab, and `OperatorDashboard.js`
deleted along with its now-redundant route in `App.js`. `Dashboard.js`'s "OPERATOR" nav link and
`OperatorRoute.js`'s own redirect target both already pointed at `/internal`, so nothing else
needed updating for this step specifically.

**Why a tab, not a second page:** matches this codebase's own established reasoning
(`OperatorRoute`'s comment on why a route boundary beats a conditional-render boundary) — one
coarse, auditable gate is easier to reason about than two.

---

### 3. Porting the circuit-board backdrop — code, not an image

The HTML page's backdrop is NOT a CSS background-image. It's a `<canvas>` element driven by a
~250-line inline `<script>`:
- Procedurally generates a PCB-trace-style graph once per page load: several random-walk
  "walkers" take axis-aligned steps on a 46px grid, occasionally branching, producing a
  branching network of `nodes`/`segments` (not a uniform grid — deliberately organic-looking).
- A real reference photo (`terra_api_circuit_board.png`, ~1.9MB) is tiled underneath the
  procedural traces as a static backdrop, at low opacity in dark mode (0.16) and full opacity
  in light mode (1.0) — the two modes intentionally look very different here, not just inverted.
- On a slow "heartbeat" interval (2.4s), several random origin nodes fire a breadth-first
  flash that propagates outward through connected segments over ~0.4s (each segment's ignite
  time = its BFS hop distance × 0.05s), rendered as a brightness ease-out per segment — this is
  the literal visual metaphor for "Terra API is the ecosystem's heartbeat/health monitor."
  Clicking anywhere on the page also fires a flash at the nearest node.
- Scrolling pans a "chip" 4x the viewport height at 35% of actual scroll speed (parallax) so the
  backdrop reads as sitting behind the content rather than scrolling with it 1:1.

This was ported into `HeartbeatBackdrop.js` (a React component wrapping the same canvas logic in
a `useEffect` with proper `cancelAnimationFrame`/listener cleanup on unmount, since React
components can unmount mid-animation in a way a static HTML page's script never has to handle)
plus `heartbeat-backdrop.css` for the two CSS rules (`.heartbeat-backdrop`/`#heartbeatCanvas`)
the original page had. The PNG was copied into `public/terra_api_circuit_board.png` (flat
`public/`, matching this repo's existing convention — no `public/assets/` subfolder invented for
this). Verified byte-identical via `md5sum` against the terra-hq-site copy after the fact, once
a later bug (see below) raised the question of whether the wrong image was somehow being served.

The component reads `--gold`/`--blue` via `getComputedStyle(document.documentElement)` and
`document.documentElement.getAttribute('data-theme')`, exactly like the HTML script did — this
worked immediately with zero extra wiring because `ThemeContext.js` already sets `data-theme` on
`<html>` (not a wrapper div) specifically so the 3D visualizer's WebGL context — which cannot
read CSS custom properties at all — has one shared, DOM-observable source of truth alongside
everything CSS-driven. The same mechanism that already existed for the visualizer's benefit
turned out to be exactly what an unrelated canvas-based backdrop needed too.

---

### 4. The full redo — copying the HTML's actual CSS, not this app's tokens

**What went wrong the first time:** the initial `ApiDashboard.js`/`api-dashboard.css` pass built
the 8 content tabs' visual layer by layering onto this app's EXISTING shared design tokens
(`dashboard.css`'s `--surface`/`--surface2`/`--gold`/etc., `.cm-card` for every section) rather
than using the HTML source's own CSS values. The class names were even renamed with an `api-`
prefix (`.api-svc-card` instead of the HTML's `.svc-card`) specifically to avoid collisions with
those shared tokens. This produced a page that was thematically similar — same color family,
same rough layout — but visibly, measurably different: different card backgrounds, different
spacing, different font sizes, because it was two independent design systems that happened to
share a palette, not one system copied from the other.

**Will's correction, verbatim:** *"can you just literaaly just copy and paste the html for
terra api strategy html here because the pages you made look different"* and, more pointedly
after the scope of the mismatch became clear: *"please it has to be identical!! copy and paste
if need be."* This is the same category of error as an earlier, separate incident this session
where a visualizer's zoom/scale values were sourced from an intermediate git commit message
instead of the file's actual current state — the specific failure mode both times was
*reconstructing* a value through reasoning/an existing system instead of *reading the actual
current source and copying it*.

**The fix:** read `terra_api_strategy.html` in full (all ~1048 lines — CSS block + every tab's
markup + the canvas script), then rewrote `api-dashboard.css` as a near-verbatim copy of the
HTML's `<style>` block (same class names — `.sh`, `.callout`, `.svc-card`, `.adr-card`,
`.eco-hero`, etc. — no `api-` prefix invented), scoped under `.api-shell` as a parent selector
(`.api-shell .callout { ... }`) purely to prevent bleeding into `Dashboard.js`/other pages, with
every property value copied as-is rather than reconciled against `dashboard.css`'s tokens. Then
rewrote all 7 non-Operator tab components' JSX to use that same markup/class structure and the
HTML's actual copy text verbatim, rather than the earlier paraphrased/restructured versions.

**One deliberate, explicitly-called-out exception:** the visualizer itself. The HTML embeds
`terra_api_visualizer_phase5.html` via an `<iframe>` (a separate vanilla-JS Three.js build,
unrelated to this app's React visualizer). Will's explicit instruction: *"only thing that
doesn't need to move is the visualizer"* and later, after some background-related confusion,
*"the oly part of visualizer that should identical to html version is background."* So
`OverviewTab.js`'s hero visualizer slot uses this app's own live `EcosystemVisualizer` React
component (same one `Dashboard.js`/`OperatorTab.js` already use) — NOT a ported iframe — with
only its *background treatment* matched to the HTML's frosted/transparent look (see the
`transparent` prop work below). Everything else about the HTML page (hero copy, stat cards, all
tab content, nav structure) WAS a literal 1:1 port.

**Real, load-bearing lesson from this correction, generalizable beyond this one page:** when a
user says "make X match Y" and Y is a real, readable source file, the correct default is to
open Y and copy its actual current bytes/values — not to infer what Y probably looks like from
memory, from a similar existing pattern in the codebase, or from an intermediate state Y passed
through in its history. Both of this session's real errors (the visualizer zoom/scale values,
and this whole page's first draft) were caused by skipping that direct-read step in favor of a
plausible-looking derivation. The fix in both cases was mechanically the same: re-read the
actual source, copy it directly, and only THEN layer in the specific, explicitly-approved
deviations (React lifecycle wiring, the visualizer-stays-live exception, later UI additions)
on top of a verified-accurate base — never skip straight to the deviations.

---

### 5. Bugs found only by Will looking at the actual rendered page

Every one of these was invisible from reading the CSS alone — each was only caught because Will
looked at a real screenshot and said something was visually wrong, then a root cause had to be
traced. Documented in the order found, since several of these initially looked like the same bug
and turned out to be unrelated.

**5a. Light-mode tab bar wrong shade of silver.** The HTML has TWO selectors sharing one
light-mode background value: `[data-theme="light"] nav,[data-theme="light"] .tabs{background:
rgba(201,206,212,0.95)}`. The port's `api-dashboard.css` only carried the light-mode override
for the nav bar (`.nav-brand-bar`), not the tab bar (`.api-tabs`) right below it — a simple
one-selector omission during the rewrite, invisible without an actual side-by-side look since
both elements are dark and similar-looking without the override. `.api-tabs` fell back to
`var(--surface)`, which is plain white in light mode, clashing visibly against the correctly-
silver nav bar directly above it. Fixed by adding the missing selector.

**5b. Visualizer showed as a solid opaque box, not the frosted circuit backdrop.** Root cause
was TWO independent opacity sources, both needing separate fixes:
  - `terraScene.js` (the Three.js scene builder shared by every `EcosystemVisualizer` usage
    across the whole app) unconditionally set `scene.background = new THREE.Color(...)` — an
    OPAQUE fill, even though the WebGL renderer was already constructed with `alpha: true`.
    Setting an opaque `THREE.Color` on `scene.background` defeats renderer alpha entirely; the
    canvas paints solid regardless of what CSS says is behind it.
  - Independently, `visualizer.css`'s `.cm-visualizer` (the container div, not the canvas) also
    painted its own opaque `background: var(--surface2, ...)`, plus a fixed `aspect-ratio`/
    `min-height`/`max-height` designed for its normal use as a self-contained card — none of
    which fit inside `.viz-frame`'s own frosted-panel sizing.

  **The fix, done carefully to avoid a wider regression:** `EcosystemVisualizer` is shared by
  `Dashboard.js` (customer page, explicitly out of scope/deferred this session) and
  `OperatorTab.js` in addition to the new `OverviewTab.js` — a global change to `scene.background`
  would have silently altered the customer dashboard's look too. Instead, `createScene(canvas,
  options)` gained a new `{ transparent: boolean }` option, defaulting to `false` (every existing
  caller's behavior is byte-for-byte unchanged unless it opts in). When `true`: `scene.background`
  and `scene.fog` are both skipped entirely (fog needs an opaque background to read as depth
  rather than a hazy vignette against a transparent canvas). `EcosystemVisualizer.js` threads a
  new `transparent` prop down to `createScene`; `setTheme()` no-ops its background repaint when
  `transparent` is set, since there's nothing to repaint. Only `OverviewTab.js` and (once the same
  visual treatment was requested there too) `OperatorTab.js` pass `transparent`. The CSS side got
  a scoped override, `.api-shell .viz-frame .cm-visualizer { background: none; aspect-ratio:
  unset; ... }`, touching only visualizer instances that happen to sit inside a `.viz-frame`.

**5c. That CSS override silently lost to `visualizer.css`'s own light-mode rule.** After 5b's fix
was written, the Operator tab's visualizer STILL showed the old opaque light-gray box — but only
in light mode; dark mode was fixed. Root cause: `visualizer.css` has its own
`:root[data-theme='light'] .cm-visualizer { background: ... }` rule, which by CSS specificity
math is a tie with the override (`.api-shell .viz-frame .cm-visualizer` = 3 plain classes =
(0,3,0); `:root[data-theme='light'] .cm-visualizer` = `:root` pseudo-class + attribute selector
+ 1 class = also (0,3,0)). On an exact specificity tie, CSS falls back to source order — and
which stylesheet's `<style>` tag landed later in the DOM depended on webpack's import/injection
order between `api-dashboard.css` (imported by `ApiDashboard.js`) and `visualizer.css` (imported
by `EcosystemVisualizer.js`), which isn't something this codebase pins or guarantees. **Fix:**
doubled the class in the selector (`.viz-frame.viz-frame` — matches the exact same elements,
since a class repeated in one compound selector doesn't change what it targets, only its
specificity value, which becomes (0,4,0)) so the override reliably wins regardless of import
order, instead of depending on an unguaranteed tie-break.

**5d. Dark-mode hero looked "washed out"/flat gray instead of showing visible circuit detail.**
This one took the longest to actually root-cause because the first two hypotheses were both
wrong. Confirmed NOT the problem, in order: (1) the PNG file itself — `md5sum` confirmed
byte-identical between terra-hq-site and this repo's `public/` copy; (2) the canvas draw
code's opacity math — `HeartbeatBackdrop.js`'s dark-mode alpha values (0.14 line, 0.18 junction,
0.16 board-image) were confirmed to match the HTML's literal numbers exactly, copied verbatim.
Both were real, necessary things to check and rule out, not wasted effort — but neither was the
actual bug.

**Actual root cause, found by reasoning through what `HeartbeatBackdrop`'s canvas is compositing
against:** the canvas is `position: fixed; z-index: -1` — it paints BEHIND EVERYTHING, including
`<body>`. `.api-shell` (the page's root div) was deliberately set to `background: transparent` so
the canvas would be visible through it — correct in isolation — but nothing was ever painting
`<body>` itself with the HTML's `body{background:var(--bg)}` equivalent. CRA's own `index.css`
sets no body background at all, so it defaulted to the browser's plain white. The canvas's
already-faint, correctly-valued traces were compositing against white instead of the HTML's
actual near-black (`#0a0c10`), reading as a flat, washed-out gray rather than "faint atmospheric
backdrop" — which is exactly the flavor of visual difference "washed out" describes. **Light mode
had looked correct THE WHOLE TIME, purely by coincidence** — the browser's default white
happens to be close enough to the light theme's actual `--bg` (`#eff0f2`) that the bug was
invisible there, which is part of why it took this long to trace: light mode gave no signal that
anything was wrong.

**Fix:** added an explicit `body { background: #0a0c10 }` / `:root[data-theme='light'] body {
background: #eff0f2 }` rule to `api-dashboard.css`. **Known, accepted risk, documented inline in
the CSS itself:** CRA/webpack injects a route's CSS on first import and never removes it on
unmount — so this global `body` rule stays live even after navigating to `/login` or the
customer dashboard, for the rest of that session, once `/internal`(now `/`) has been visited
once. This is safe ONLY because every other route's own root element is opaque and covers the
full `100vh` viewport (`Dashboard.js`'s `.command-matrix`, `Login.js`'s `.login-page`), fully
masking `<body>` regardless of what color it is underneath. If a future page is ever added that
doesn't fully cover the viewport, this rule would leak through as a visible wrong-colored edge —
flagged in the CSS comment as something to remember if that's ever debugged later, since the
connection back to this fix would not be obvious from that future bug report alone.

  A separate, related tuning pass happened alongside these fixes: the hero's `padding`
  (originally the HTML's literal `88px 40px 56px`) was cut to `40px 40px 28px` because this
  React page has sticky nav+tabs chrome stacked above the hero that the static HTML page never
  had to stack against in the same way — a literal port pushed the visualizer below the fold on
  page load. Once the hero shrank, the SAME gradient/blur values the HTML uses (tuned for an
  88px-tall hero) covered proportionally more of the now-smaller box, independently contributing
  to the washed-out look — eased those values down too (`rgba(...,0.7)`→`0.55`,
  `blur(5px)`→`blur(3px)`, etc.), explicitly logged in the CSS as tuning to compensate for a
  size change already made, not a re-match against the HTML's literal numbers (which no longer
  apply 1:1 once the box itself is a different size).

---

### 6. UI additions with no HTML source equivalent

These are all deliberate DEVIATIONS from the "identical to the HTML" mandate, each requested
directly by Will as new work, not corrections to the port:

- **"FOUNDATION LAYER" nav badge removed entirely**, not replaced with anything — this app has
  no equivalent live-status concept the HTML's Cloudflare-live badge was standing in for.
- **Nav logo replaced with an honest placeholder.** The HTML's static "TERRA API" text wordmark
  was swapped for a plain, deliberately-unstyled dashed-outline box reading "LOGO" — same
  pattern already established by `Login.js`'s social-sign-in placeholder buttons (Terra-branded
  shapes, explicitly never real Google/Apple logos): the placeholder should read as "not built
  yet," not be mistaken for a real (if minimal) design choice. Will's own framing: he'll design
  the real mark later, "probably another animation." Logged as TFE-602 in `TASKS.md` alongside
  the still-default CRA React-logo favicon (`public/favicon.ico`/`logo192.png`/`logo512.png`),
  same category of pending work, no code changes needed when the real assets exist — just
  matching-filename replacement.
- **Mobile hamburger + tab drawer**, built from scratch (the HTML just lets its 9 tabs
  horizontally scroll below 768px via `overflow-x:auto`, no hamburger at all). Went through two
  iterations based on direct feedback: v1 only rendered the button below the 768px breakpoint
  (matching a literal "mobile menu" read of the request) — Will clarified he wanted it visible
  and usable at ANY viewport width, so the CSS gating was removed and the drawer's visibility is
  now controlled entirely by React state (`menuOpen`), not a media query. v2 initially placed
  the button on the left of the nav (conventional hamburger position, ahead of the logo); Will
  asked to flip sides with the sign-out button, so it now sits on the right, after theme-toggle
  and sign-out. The drawer itself re-renders the exact same `TABS` array as the horizontal bar,
  as `role="tablist"`/`role="tab"` buttons (not `role="menu"`/`"menuitem"`, which don't support
  `aria-selected` per `jsx-a11y/role-supports-aria-props` — caught by lint, not by inspection).

---

### 7. Root route swap — `/` becomes the internal page, not the customer dashboard

Final change of this session: Will's app is his own internal tool right now, not a live
customer product, so the SPA's default landing route ("/") should open on the operator/API page,
not an empty customer dashboard nobody's using yet.

**The real hazard, caught before writing any code:** `OperatorRoute.js` redirects non-operators
to a fallback path when `isOperator()` is false. That fallback was hardcoded to `"/"`. If `"/"`
itself became the SAME gated route, a non-operator landing on `"/"` would be redirected back to
`"/"` — an infinite redirect loop. Will confirmed the fix should be the "correct" one (swap the
redirect target too) rather than the "it's just me using this for now" shortcut, even though the
latter would have worked today with zero real users to break.

**Changes:** `App.js` — `"/"` now renders `ApiDashboard` behind `OperatorRoute`; the customer
`Dashboard` moved to a new `"/dashboard"` route behind the existing generic `ProtectedRoute`
(unaffected by any of this, since it has no hardcoded destination assumptions of its own).
`OperatorRoute.js` — its non-operator fallback changed from `<Navigate to="/" replace />` to
`<Navigate to="/dashboard" replace />`. `Dashboard.js` — its "OPERATOR" nav link updated from
the now-nonexistent `/internal` to `"/"`. `Login.js` — deliberately left UNCHANGED: its
post-login fallback (`navigate(redirectTarget || '/')`, used only when no `?redirect=` query
param is present) already lands on `"/"`, which is now correctly the internal page — this was
already the desired behavior once the swap landed, not a separate bug to fix.

---

### Known Limitations / Next
- **Not verified on a real mobile device or browser devtools' responsive mode.** Every mobile-
  related claim in this entry (breakpoint coverage, drawer behavior, hamburger positioning) is
  based on a careful line-by-line reading of the CSS, cross-checked against the HTML source's
  own `@media` rules — NOT an actual rendered screenshot at a narrow viewport. No browser
  automation tool was available in this session to verify visually. The 7 ported content tabs
  carry the HTML's exact `@media (max-width: 768px)` rules verbatim, so those specifically
  should be low-risk; the `.viz-frame` visualizer areas and the tab drawer are React-only
  additions with no HTML mobile behavior to have copied, so they're comparatively less verified.
- `/internal` as a URL no longer exists (moved to `/`) — worth checking whether anything outside
  this repo (bookmarks, other services, documentation) still links to the old path.
- TFE-602 (logo + favicon placeholders) stays open until Will's real designs exist.
- Nothing in this session was committed or pushed — confirmed via `git log`/`git status -sb`
  before this entry was written; nothing in this list should be read as already-live in any
  deployed environment.
