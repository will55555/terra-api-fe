# terra-api-fe Tasks
<!-- Repo-local task tracker. IDs referenced from HUB_STATE.md -> terra-api-fe (prefix: TFE). -->
<!-- Phase numbers below match terra-api-adr-009's "Build Sequence" section (added 2026-07-24). -->

- [x] TFE-001 - Confirm frontend deploy architecture: standalone repo (own GitHub remote
      `will55555/terra-api-fe`), NOT the originally-floated monorepo-subdirectory-of-terra-api
      plan. Dual-remote confirmed 2026-07-24 - `bitbucket` (`terra-inc-dev/terra-api-fe`) added
      locally, matching terra-api's pattern.
- [x] TFE-002 - Push local `main` to `bitbucket` remote to resync the mirror. DONE 2026-07-24 -
      `bitbucket/main` now at `41c5ebd`, matches `origin/main`.
- [x] TFE-003 - Adopt terra-api's phase-branch workflow (Will confirmed 2026-07-24): one branch
      per phase, pre-PR branch + SonarQube cleanup before merging to `main`, original phase
      branch kept untouched with full history.

## Phase 1 - Auth Shell (branch `phase-1-auth-shell`, cut 2026-07-24)
- [x] TFE-101 - Login flow + JWT bearer storage/attach against terra-api's existing auth
      endpoints (terra-api-adr-003, already live). Done 2026-08-01 — see DEV_LOG.md.
- [x] TFE-102 - Protected-route shell (redirect unauthenticated users to login). Done 2026-08-01.
- [x] TFE-103 - Environment-based endpoint config (dev/prod API base URL). Done 2026-08-01.

**No signup flow, by design (not a gap):** terra-api's `AuthService` validates against a
single hardcoded service-account credential (`TerraAuthProperties`, config-driven) — no user
database exists yet. Per ADR-003's Issuer Model, a real user DB is gated behind a specific
trigger (a second independent identity consumer, among others) that hasn't fired. Real
per-customer accounts arrive with ADR-011's `customer_service_access` table (Phase 3 backend
work, TFE-301/302/303) — even that's a single seeded row, not self-service registration.
Don't build a Sign Up page until that backend work exists to register against.

## Phase 2 - Same-Origin Deploy Wiring (spans this repo + terra-api)
- [x] TFE-201 - Jenkins: build this repo (`npm ci && npm run build`), copy `build/` into
      terra-api's `src/main/resources/static` before terra-api's jar is packaged
      (terra-api-adr-009, 2026-07-24 Update #2). Lives in terra-api's Jenkinsfile, tracked here
      since it's this repo's deploy dependency. **Live-verified 2026-08-02**: full pipeline green
      end-to-end on `phase-7-frontend-ci-integration` build #2 (Checkout Frontend → Build Frontend
      → Test Frontend → Copy Frontend Build → gradle Build/Test → Docker image → Push → Deploy to
      Staging), staging containers confirmed `Up`/healthy on the real EC2 box. Two lockfile bugs
      fixed first (typescript floated to an incompatible major via an unpinned optional peer dep,
      tailwindcss/yaml peer conflict) — both closed via `rm -rf node_modules package-lock.json &&
      npm install` plus a `typescript` override pin; full detail in `DEV_LOG.md`. Also added this
      repo's own CI-only `Jenkinsfile` (checkout/build/test, no deploy — same-origin means no
      independent artifact) and split both repos' Jenkins jobs into `-main`/`-branches` pairs for
      organizational clarity. `phase-1-auth-shell` merged into `main` as a prerequisite, since
      Jenkins builds `main` and Phase 1 hadn't landed there yet.

## Phase 3 - Backend Health, Entitlement & Role Claim (terra-api repo, not this one)
- [x] TFE-301 - `GET /api/v1/ecosystem/health` endpoint (terra-api-adr-005 amendment).
- [x] TFE-302 - `customer_service_access` table, seeded single-row (terra-api-adr-011).
- [x] TFE-303 - `role`/`aud` JWT claim on `SelfTokenIssuer`/`TokenValidator` (terra-api-adr-010's
      trigger fired via this build; bundled into this phase for deploy efficiency, not because
      Phase 4 needs it yet).

## Phase 4 - Visualizer Integration (this repo, depends on Phase 3)
> **Naming note:** two unrelated "phase" numbers collide here and it has caused real
> confusion. This is **ADR-009 Build Sequence Phase 4** (auth shell → deploy wiring →
> backend health → visualizer), and the branch is `phase-4-visualizer`. It ports
> **`terra_api_visualizer_phase5.js`**, which is hq-site's own version number for that FILE
> — phases 1-4 of it sit in `terra-hq-site/archive/` and are superseded. Both numbers are
> correct; they count different things. phase5 is the best/current visualizer and is what
> ADR-009 calls the shared Three.js reference implementation.
- [x] TFE-401 - Repurpose `terra-hq-site/terra_api_visualizer_phase5.js`'s Three.js logic into
      this repo.
- [x] TFE-402 - Cube filtering per customer, consuming Phase 3's entitlement-filtered endpoint.
- [x] TFE-403 - Health-tier color model (HEALTHY/YELLOW/ORANGE/RED, grey/navy off-state) per
      terra-api-adr-009's Consequences section.
- Note: can start on static/mock data in parallel with Phase 3, switch over once the real
  endpoint exists.

## Phase 5 - Production Reachability & Hardening (not an ADR-009 build-sequence phase; ops/quality gaps found post-launch)
- [x] TFE-501 - Fix: SPA static assets return 401 for unauthenticated visitors, so nobody can
      actually reach the dashboard despite a working deploy. **Root cause confirmed 2026-08-03**:
      the Jenkins `master` pipeline (build #6, `81d4d7e`) ran "Copy Frontend Build" → "Deploy to
      Prod" successfully — the deploy mechanism (TFE-201) works, on staging AND prod. The actual
      bug was `terra-api/SecurityPaths.PERMIT_ALL_PATTERNS` never including the SPA's own routes
      — only `/actuator/**`, `/api/auth/login`, `/api/v1/ecosystem/public-health`, `/error` were
      permitted, so Spring Security 401s the shell itself before a browser ever gets the JS to
      run the client-side login redirect (TFE-102). Superseded HUB_STATE's prior "the deploy has
      never run" framing — that was wrong; the deploy runs fine, reachability was a
      security-config gap. **Real fix shipped**: an enumerated-static-asset-list approach was
      drafted first and discarded — it could never cover an arbitrary client-side React Router
      path (e.g. a bookmarked `/dashboard`), since Ant patterns can't express "permit everything
      except X." Replaced with a full posture flip in `SecurityPaths`/`SecurityConfig`: `/api/**`
      requires auth by default (verified 2026-08-03 that every `@RestController` in the codebase
      lives under `/api/**` — nothing else exposes data), everything else is public by design,
      covering any client-side route including deep-links with zero maintenance. **Live-verified
      2026-08-03** after redeploy: `GET /` → `200` (was `401`); `GET
      /api/v1/ecosystem/public-health` still `200` (unaffected); `GET /api/v1/flags` without a
      token still `401` (still correctly guarded).
- [ ] TFE-502 - Fix: a 401 leaves the user on a broken page instead of redirecting to login (hit
      twice 2026-08-02).
- [ ] TFE-503 - Test coverage: 10 of 12 modules have none (only `healthColors`/`domainConfig`
      covered, 18 tests).
