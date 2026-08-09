import React from 'react';

// Migrated verbatim (markup + copy) from terra-hq-site/terra_api_strategy.html's
// #view-adrs, 2026-08-09. ADR-009's description keeps the HTML's original wording
// ("terra-api-fe (React dashboard)") since this is a literal copy, not a paraphrase.
export default function AdrsTab() {
  return (
    <div className="block">
      <div className="sh">
        <span className="sh-index">11</span>
        <span className="sh-title">Architecture Decision Records</span>
        <span className="sh-line" />
        <span className="sh-note">terra-api-adr-001 through terra-api-adr-010 — all accepted — ecosystem-wide CI/CD patterns in adr-010</span>
      </div>

      <div className="adr-list">
        <div className="adr-card">
          <div className="adr-id">001</div>
          <div>
            <div className="adr-title">Dashboard Gateway Service</div>
            <div className="adr-desc">Terra API is the central gateway for all Terra dashboards — routes browser frontend requests to all upstreams (Notion, ROMS, PIOS), eliminating CORS issues and providing a single stable contract. Spring Boot over FastAPI: ROMS infrastructure reuse, production-level expertise, zero new infra for Phase 1. <strong>terra-api-adr-001</strong></div>
          </div>
          <span className="badge b-p1">Phase 1</span>
        </div>

        <div className="adr-card">
          <div className="adr-id">002</div>
          <div>
            <div className="adr-title">Notion → Obsidian Selective Push</div>
            <div className="adr-desc">Selective sync workflow — specific Notion content can be pushed to the Obsidian vault via Terra API's proxy endpoint. Development tooling only, not a production dependency. Triggered by webhook or manual dashboard action. Not a full two-way sync. <strong>terra-api-adr-002</strong></div>
          </div>
          <span className="badge b-p2">Phase 2</span>
        </div>

        <div className="adr-card">
          <div className="adr-id">003</div>
          <div>
            <div className="adr-title">Auth &amp; Identity Strategy</div>
            <div className="adr-desc">Three-phase progressive auth hardening. Phase 1: EC2 Security Group IP allowlist only — no application auth code. Phase 2: Static X-Terra-Api-Key header via Spring Security filter. Phase 3: JWT bearer token validated against Terra Auth service public key — stateless, no DB round-trip. Deferring JWT until Terra Auth exists avoids speculative engineering against a non-existent issuer. <strong>terra-api-adr-003</strong></div>
          </div>
          <span className="badge b-all">All Phases</span>
        </div>

        <div className="adr-card">
          <div className="adr-id">004</div>
          <div>
            <div className="adr-title">Resilience &amp; Error Handling</div>
            <div className="adr-desc">Phase 2: Stale fallback — serve Caffeine stale entry on upstream timeout with staleness metadata in response body. Phase 3: Resilience4j circuit breaker per upstream. Partial mitigation first (Phase 2), full circuit breaker after load warrants the complexity (Phase 3). <strong>terra-api-adr-004</strong></div>
          </div>
          <span className="badge b-p2">Phase 2–3</span>
        </div>

        <div className="adr-card">
          <div className="adr-id">005</div>
          <div>
            <div className="adr-title">Ecosystem Health Orchestration</div>
            <div className="adr-desc">Sidecar heartbeat registry across all Terra services. Graduated quarantine: Healthy → Degraded → Suspect → Quarantined. On quarantine: inter-service token issuance suspended + event bus write access blocked for the affected service. Blast radius containment — compromise or failure of one service is isolated at the foundation without cascading to others. <strong>terra-api-adr-005</strong></div>
          </div>
          <span className="badge b-p3">Phase 3</span>
        </div>

        <div className="adr-card">
          <div className="adr-id">006</div>
          <div>
            <div className="adr-title">Rate Limit Enforcement</div>
            <div className="adr-desc">Token bucket rate limiting per client tier enforced at the single gateway entry point. Gateway enforcement means no per-service rate limiting required — the bottleneck is the single inbound surface. Phase 3 only — unnecessary at personal-use scale in Phase 1–2. <strong>terra-api-adr-006</strong></div>
          </div>
          <span className="badge b-p3">Phase 3</span>
        </div>

        <div className="adr-card">
          <div className="adr-id">007</div>
          <div>
            <div className="adr-title">Audit Log Bus</div>
            <div className="adr-desc">Tamper-evident, append-only inter-service activity log with correlation ID and causation ID chain. Every inter-service call passes through Terra API — the audit log is a near-zero-cost byproduct of normal gateway operation. Requires persistent storage deferred to Phase 3 when a DB on Terra API is justified by operational need. <strong>terra-api-adr-007</strong></div>
          </div>
          <span className="badge b-p3">Phase 3</span>
        </div>

        <div className="adr-card">
          <div className="adr-id">008</div>
          <div>
            <div className="adr-title">Feature Flag Service</div>
            <div className="adr-desc">YAML-driven, hot-reload feature flags served as a read-only API consumed by all Terra subsidiary services. Single authoritative flag source — change propagates to all consumers on next poll without redeployment. Enables coordinated ecosystem-wide capability gating without centralizing decision logic in any product domain. <strong>terra-api-adr-008</strong></div>
          </div>
          <span className="badge b-p3">Phase 3</span>
        </div>

        <div className="adr-card">
          <div className="adr-id">009</div>
          <div>
            <div className="adr-title">Visualizer Frontend Integration</div>
            <div className="adr-desc">Two visualizer instances, both reading from Terra API's ecosystem-health endpoints. terra-hq-site hosts the full public visualizer via the genuinely public, unauthenticated <code>GET /api/v1/ecosystem/public-health</code> (added later, since the browser can't reach the unpublished management port); terra-api-fe (React dashboard) hosts a scoped, authenticated customer view via <code>GET /api/v1/ecosystem/health</code>, filtered to each customer's entitlements. Both live on the main API port (8080/HTTPS), not the management port. Same Three.js logic, different endpoint and filtering. <strong>terra-api-adr-009</strong></div>
          </div>
          <span className="badge b-p2">Phase 2</span>
        </div>

        <div className="adr-card">
          <div className="adr-id">010</div>
          <div>
            <div className="adr-title">Ecosystem CI/CD &amp; Deployment Strategy</div>
            <div className="adr-desc">All Terra services (ROMS, Terra API, PIOS, business verticals) follow the ROMS CI/CD pattern: Jenkinsfile declarative pipeline + Docker multi-stage builds. Terra API and ROMS are each live on their own dedicated EC2 instance, with a shared Jenkins instance running CI/CD for both. Docker images pushed to Docker Hub registry. Ecosystem health consumed via dedicated public/customer-scoped API endpoints (not the management port, which is deliberately unpublished) for visualizer and health bus consumption. Environment-driven config via docker.env and Spring profiles. <strong>terra-api-adr-010</strong></div>
          </div>
          <span className="badge b-all">All Phases</span>
        </div>
      </div>
    </div>
  );
}
