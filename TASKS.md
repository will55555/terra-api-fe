# terra-api-fe Tasks
<!-- Repo-local task tracker. IDs referenced from HUB_STATE.md -> terra-api-fe (prefix: TFE). -->

## Active
- [x] TFE-001 — Confirm frontend deploy architecture: standalone repo, not a subdirectory of terra-api. Dual-remote confirmed with Bitbucket mirror matching terra-api's pattern.
- [x] TFE-002 — Resync the Bitbucket mirror for terra-api-fe so the mirror stays aligned with the GitHub main branch.
- [x] TFE-003 — Adopt the phase-branch workflow used by terra-api: one branch per phase, with pre-PR cleanup before merging to main.

## Phase 1 - Auth Shell
- [x] TFE-101 — Login flow and JWT bearer attach against terra-api auth endpoints; this was completed as the auth shell for the frontend.
- [x] TFE-102 — Protected-route shell for unauthenticated users, redirecting to login where appropriate.
- [x] TFE-103 — Environment-based API endpoint configuration for dev and prod deployments.

## Phase 2 - Deploy Wiring
- [x] TFE-201 — Wire frontend build output into terra-api deployment so the frontend is packaged with the backend build.

## Phase 3 - Backend Health & Entitlements
- [x] TFE-301 — Support ecosystem health endpoints so the frontend can consume shared health data.
- [x] TFE-302 — Seed customer service access data for the entitlement model.
- [x] TFE-303 — Add role and audience claims to JWTs so the frontend can rely on richer auth context.

## Phase 4 - Visualizer Integration
- [x] TFE-401 — Port the public visualizer experience into this repo, using the shared Terra API health model.
- [x] TFE-402 — Filter cubes per customer entitlement so the visualizer reflects what the customer is allowed to see.
- [x] TFE-403 — Apply health-tier color states so cubes reflect HEALTHY, YELLOW, ORANGE, and RED states.

## Phase 5 - Reachability & Hardening
- [x] TFE-501 — Fix unauthenticated SPA reachability so the dashboard can actually load without getting blocked by security rules.
- [ ] TFE-502 — Redirect unauthenticated users to login instead of leaving them on a broken page when auth is required.
- [ ] TFE-503 — Expand frontend test coverage so the visualizer and dashboard remain stable as the feature set grows.

## Backlog — Refinement / Future Design Work
- [ ] TFE-601 — "My Services" / "Ecosystem" tab split. Design brainstormed 2026-08-08, not yet
      built — deliberately shelved for a dedicated design session, not today's work. Root
      observation: today ALL 8 domain cubes + all launchpad cards render identically for every
      customer regardless of entitlement (`customer_service_access` only ever changes cube/card
      COLOR via `statusByServiceId`, never visibility) — conflates ecosystem-wide product
      maturity (`productConfig.js`'s `isLocked`, same for everyone) with per-customer
      entitlement (currently unused by the frontend for gating anything). Agreed direction:
      two tabs inside `Dashboard.js` (no routing change) — "My Services" (new default; reuses
      `ProductLaunchpad`'s card grid filtered to `PRODUCTS.filter(p => p.serviceId &&
      statusByServiceId[p.serviceId])`, no 3D scene, needs an honest empty state for zero
      entitlements) and "Ecosystem" (today's full `terraScene.js` topology + unfiltered
      launchpad, unchanged — stays the discovery/upsell surface). Deferred/known gap, not
      addressed: entitled-but-currently-unreported services (health endpoint silently omitting
      a truly-entitled service during an outage) — revisit if actually observed, not designed
      against speculatively. A separate, later idea floated in the same conversation — some kind
      of 3D/animated transition for the customer review experience — is its own future design
      project, not scoped here at all.
- [ ] TFE-602 — Replace placeholder branding on the /internal (ApiDashboard) page and app-wide
      favicon with Will's real designs, once they exist. Two independent slots, same status
      (placeholder now, design TBD, likely animated per Will 2026-08-09):
      (1) Nav logo — `ApiDashboard.js`'s `.nav-brand-placeholder` span (currently plain text
      "LOGO" in a dashed box, deliberately unstyled so it reads as "not built" rather than a
      real design choice — same pattern as `Login.js`'s social-login placeholders). Swap the
      whole span for the real mark/animation; styling lives in `api-dashboard.css`.
      (2) Browser tab favicon — still CRA's default React logo. Three files, no code changes
      needed: `public/favicon.ico`, `public/logo192.png`, `public/logo512.png` (referenced from
      `public/index.html` and `public/manifest.json`) — replace in place with matching
      filenames once designed.
- [ ] TFE-603 — JWT session expiry has no user-facing handling. Found 2026-08-09: tokens expire
      after 1 hour (`terra-api`'s `application.yaml`, `jwt-expiration-ms: 3600000`), no refresh
      mechanism exists, and the frontend gives zero warning when it happens — `/api/v1/internal/
      ecosystem` starts 401ing and `OverviewTab`/`OperatorTab`'s `EcosystemVisualizer` just shows
      a permanent "STATUS UNAVAILABLE / Reconnecting" wireframe state that never resolves on its
      own. Confirmed live: logging out and back in immediately fixes it — the bug is purely the
      silent-failure UX, not a backend problem. Needs one of: (a) a real refresh-token flow
      (bigger, touches `AuthService`/`TokenIssuer` on the backend), or (b) at minimum, detect a
      401 from an authenticated fetch and show a clear "Session expired — log in again" prompt
      /redirect instead of the current infinite silent retry loop (`useOperatorEcosystem.js` and
      `useEcosystemHealth.js` both poll on an interval and don't currently distinguish
      "transient network error, keep retrying" from "401, stop and prompt"). Deliberately not
      fixed same session found — auth-flow work deserves its own focused pass.
- [ ] TFE-604 — Menu popover feature ideas, noted 2026-08-09 for a future refinement pass
      (explicitly NOT scoped/built yet, just captured so they aren't lost): once the hamburger
      menu becomes a real anchored popover (see the same-day redesign that replaced the
      full-width drawer), consider adding: (1) account info display at the top — logged-in
      email + role (e.g. "admin@terra-hq.com · Operator"), so it's visible without opening dev
      tools, similar to how YouTube's account dropdown shows the channel name/avatar; (2) quick
      links to `/dashboard` (customer view) and `/login` (switch account) directly in the menu,
      since Will is now routinely testing both operator and customer views from one browser;
      (3) a small live system-status indicator (colored dot reflecting overall ecosystem health)
      in the menu itself, so status is visible without navigating to the Overview tab. All three
      are independent, additive, and low-risk to build whenever this page gets its next design
      pass — none block the current popover-redesign work.
- [ ] TFE-605 — Cube slow-pulse animation, noted 2026-08-09 for a future refinement pass: the
      original (phase5/hq-site) visualizer had a slow ambient pulse on cubes, which this React
      port (`terraScene.js`) does not currently reproduce. Deliberately deferred same session
      found — Will's own framing was "that'll be lots of math," i.e. real animation-curve work
      (likely a per-cube sine/easing driver on emissive intensity or scale, synced but offset per
      cube so they don't pulse in lockstep), not a quick add. Note: `shouldPulse(status)` already
      exists and is wired for health-driven pulsing (see `applyHealth` in `terraScene.js`,
      `healthColors.js`) — confirm whether this ask is about THAT pulse not firing/looking right,
      or a separate always-on ambient pulse phase5 had independent of health state, before
      starting the implementation.
