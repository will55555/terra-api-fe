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
