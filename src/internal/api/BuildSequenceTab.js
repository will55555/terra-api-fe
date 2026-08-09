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
            <div className="br-title">Phase 2 — Core Infrastructure <span className="badge b-p2" style={{ marginLeft: '8px' }}>After Phase 1 Stable</span></div>
            <div className="br-desc">
              Caffeine in-memory cache with per-endpoint TTLs (ADR-001). Stale fallback on upstream failure — serve cached data with staleness metadata rather than 503 where possible (ADR-004). Static API key auth via X-Terra-Api-Key header — Spring Security filter, no service dependency (ADR-003 Phase 2). Resilience4j circuit breaker pattern added per upstream. NotionHealthIndicator and upstream health monitoring. Notification infrastructure activated. Billing primitives layer scaffolded.
            </div>
          </div>
        </div>

        <div className="build-row">
          <div className="br-num">3</div>
          <div className="br-body">
            <div className="br-title">Phase 3 — Full Foundation Layer <span className="badge b-p3" style={{ marginLeft: '8px' }}>After PIOS MVP</span></div>
            <div className="br-desc">
              JWT auth via Terra Auth service (separate future service) — stateless validation against public key (ADR-003 Phase 3). Ecosystem health orchestration and quarantine enforcement — sidecar heartbeat registry, graduated health states, blast radius containment (ADR-005). Rate limiting — token bucket per client tier at the single gateway entry point (ADR-006). Audit log bus — tamper-evident, append-only, correlation ID chain (ADR-007). Feature flag service — YAML-driven, hot-reload, all services consume read-only (ADR-008). ROMS CRM reads via Terra API (read-only proxy — Terra API never owns ROMS domain data). PIOS event WebSocket stream. Separate EC2 instance evaluated if load warrants.
            </div>
          </div>
        </div>
      </div>

      <div className="block">
        <div className="sh"><span className="sh-index">10</span><span className="sh-title">Pre-Build Gate</span><span className="sh-line" /></div>
        <div className="callout teal">
          <strong>Before Phase 1 build starts:</strong> Google Workspace live (will@terra-hq.com) — team identity and dev tooling. Cloudflare Access on terra-hq.com — strategy docs secured. AWS account governance reviewed — ROMS and Terra API sharing vs. separate accounts. EC2 Security Group updated to include CI/CD runner IP for Phase 2 deploy pipeline.
        </div>
      </div>
    </>
  );
}
