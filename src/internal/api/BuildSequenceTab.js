import React from 'react';

// Migrated verbatim (markup + copy) from terra-hq-site/terra_api_strategy.html's
// #view-build, 2026-08-09.
export default function BuildSequenceTab() {
  return (
    <>
      <div className="block">
        <div className="sh"><span className="sh-index">09</span><span className="sh-title">Three Build Phases</span><span className="sh-line" /></div>
        <div className="callout red">
          <strong>Terra API is #1 coding priority, elevated above PIOS.</strong> PIOS's accepted ADRs (ADR-011 through ADR-014) specify Terra API shared JWT as PIOS's auth layer from day one. Building PIOS before Terra API is ready creates integration debt on a capital governance system with strict auditability requirements. The gate holds.
        </div>

        <div className="build-row">
          <div className="br-num">1</div>
          <div className="br-body">
            <div className="br-title">Phase 1 — Foundation Bootstrap <span className="badge b-p1" style={{ marginLeft: '8px' }}>Done</span></div>
            <div className="br-desc">
              Gradle scaffold → Spring Boot 3.x, Java 21. Spring Boot Actuator health endpoint at management port 8082 (unpublished — not browser-reachable). Deployed on EC2, port 8080, behind real HTTPS at <strong>api.terra-hq.com</strong> (Cloudflare-proxied). Auth evolved past the original IP-allowlist plan to real JWT-based application auth plus scoped CORS for browser clients. The Notion/Obsidian proxy mentioned in earlier drafts of this plan was fully removed — it never became a core dependency and was deleted outright once superseded.
              <br /><br />
              <strong>Phase 1 shipped as the platform's real foundation</strong>, not a throwaway bootstrap — auth, rate limiting, audit logging, feature flags, and the ecosystem health/quarantine model are all live on top of it.
            </div>
          </div>
        </div>

        <div className="build-row">
          <div className="br-num">2</div>
          <div className="br-body">
            <div className="br-title">Phase 2 — Core Infrastructure <span className="badge b-p1" style={{ marginLeft: '8px' }}>Done</span></div>
            <div className="br-desc">
              <strong>Shipped, not pending</strong> — auth moved straight to real JWT (ADR-003 Phase 3) rather than stopping at the originally-planned static API key step. Caffeine in-memory cache with per-endpoint TTLs (ADR-001). Stale fallback on upstream failure — serve cached data with staleness metadata rather than 503 where possible (ADR-004). Resilience4j circuit breaker pattern added per upstream. Notification infrastructure activated. Billing primitives layer scaffolded. The Notion proxy this phase originally centered on (NotionHealthIndicator, upstream health monitoring) was removed outright once superseded — see Phase 1.
            </div>
          </div>
        </div>

        <div className="build-row">
          <div className="br-num">3</div>
          <div className="br-body">
            <div className="br-title">Phase 3 — Full Foundation Layer <span className="badge b-p2" style={{ marginLeft: '8px' }}>Mostly Shipped</span></div>
            <div className="br-desc">
              <strong>Most of this phase is already live</strong> — Ecosystem health orchestration and quarantine enforcement (ADR-005), rate limiting (ADR-006), audit log bus (ADR-007), and the feature flag service (ADR-008) are all Accepted and shipped, ahead of PIOS. JWT auth is self-issued today (ADR-003 Tier 1, real customers table + BCrypt login) rather than validated against a separate Terra Auth service — that extraction remains gated on a second independent identity consumer. Still genuinely pending: OMS CRM reads via Terra API, PIOS event WebSocket stream (blocked on PIOS having any code at all — it remains design-phase only), and evaluating a separate EC2 instance if load warrants.
            </div>
          </div>
        </div>
      </div>

      <div className="block">
        <div className="sh"><span className="sh-index">10</span><span className="sh-title">Pre-Build Gate</span><span className="sh-line" /></div>
        <div className="callout teal">
          <strong>Historical — Phase 1 pre-work, now complete:</strong> Google Workspace live (will@terra-hq.com) — team identity and dev tooling. Cloudflare Access on terra-hq.com — strategy docs secured. AWS account governance reviewed — OMS and Terra API sharing vs. separate accounts. EC2 Security Group updated to include CI/CD runner IP for Phase 2 deploy pipeline.
        </div>
      </div>
    </>
  );
}
