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
        <span className="sh-note">terra-api-adr-001 through terra-api-adr-013 — 9 accepted, 4 proposed/designed — see individual cards for status</span>
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
            <div className="adr-desc">Selective sync workflow — specific Notion content can be pushed to the Obsidian vault via Terra API's proxy endpoint. Development tooling only, not a production dependency. Triggered by webhook or manual dashboard action. Not a full two-way sync. Designed, not built — n8n workflow, Notion DB property, and ingestion pipeline remain unbuilt. <strong>terra-api-adr-002</strong></div>
          </div>
          <span className="badge b-proposed">Designed, Not Built</span>
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
            <div className="adr-title">Tier/Role Claim Separation (HQ Route Gating)</div>
            <div className="adr-desc">Splits two concerns the existing <code>tier</code> claim conflated: rate-limit generosity (how much a caller can do) vs. audience/page access (who a caller is and what they should see). <code>tier</code> stays untouched, rate-limiting only. A new, independent <code>role</code>/<code>aud</code> claim is added to the JWT contract for HQ route gating (public/customer/investor/internal), decoupled from throughput. Trigger-gated, not calendar-gated: not built yet because nothing today reads <code>role</code> — building it before HQ has a real consumer (terra-api-fe's <code>/customer</code> or <code>/internal</code> section) would be premature scaffolding. <strong>terra-api-adr-010</strong></div>
          </div>
          <span className="badge b-proposed">Proposed</span>
        </div>

        <div className="adr-card">
          <div className="adr-id">011</div>
          <div>
            <div className="adr-title">Customer Service Entitlement Model</div>
            <div className="adr-desc">A <code>customer_service_access(customer_id, service_id)</code> Postgres table, queried at request time by <code>GET /api/v1/ecosystem/health</code> and keyed on the JWT's <code>sub</code> claim — answers &quot;what can this customer see,&quot; distinct from ADR-003's &quot;who is this caller.&quot; The schema seam exists and the endpoint works end-to-end, but the table ships empty: no customer identity exists yet to seed it against (the only <code>sub</code> issued today is ROMS's service account, not a human customer). Entitlement-assignment tooling is deliberately deferred until a second real customer account is provisioned. <strong>terra-api-adr-011</strong></div>
          </div>
          <span className="badge b-p3">Phase 3</span>
        </div>

        <div className="adr-card">
          <div className="adr-id">012</div>
          <div>
            <div className="adr-title">Internal Operator Dashboard</div>
            <div className="adr-desc">A separate <code>/internal</code> route inside terra-api-fe (not a separate app), gated on the <code>internal</code> audience — built after prod ran degraded for roughly 40 hours undetected. Authorization is enforced server-side; the route gate is UX only. Requires BOTH <code>role=internal</code> AND an explicit <code>ops:read</code> scope — role alone would accidentally grant the ROMS service account (legitimately <code>role=internal</code> as infrastructure) visibility into cross-customer operator data. A real operator account now exists (provisioned directly against prod 2026-08-09, TAPI-025) — the gate has a live consumer, not just built-and-waiting. <strong>terra-api-adr-012</strong></div>
          </div>
          <span className="badge b-proposed">Proposed</span>
        </div>

        <div className="adr-card">
          <div className="adr-id">013</div>
          <div>
            <div className="adr-title">Customer Identity &amp; Login Strategy</div>
            <div className="adr-desc">Resolves the gap ADR-011 surfaced: no user database exists for real customer logins, only a single self-issued service-account credential. Deliberately unscheduled — sequenced after the EC2 right-size and OS-patching work closes, and blocked on pending frontend and design rework (both TBD scope). The <code>/internal</code> operator gate (ADR-012) also has no way to provision a real operator identity until an identity system exists. <strong>terra-api-adr-013</strong></div>
          </div>
          <span className="badge b-proposed">Proposed, Unscheduled</span>
        </div>
      </div>
    </div>
  );
}
