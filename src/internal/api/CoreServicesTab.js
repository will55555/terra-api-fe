import React from 'react';

// Migrated verbatim (markup + copy) from terra-hq-site/terra_api_strategy.html's
// #view-services, 2026-08-09.
export default function CoreServicesTab() {
  return (
    <div className="block">
      <div className="sh"><span className="sh-index">05</span><span className="sh-title">Six Foundation Services</span><span className="sh-line" /></div>
      <div className="callout">
        Each service exists at the foundation level because every Terra product needs it and building it independently in each product creates divergence, duplication, and coupling risks that make individual vertical exits or spin-offs structurally difficult. The foundation layer is shared precisely to prevent that.
      </div>

      <div className="svc-grid">
        <div className="svc-card">
          <div className="svc-label">Service 1</div>
          <div className="svc-title">Auth / Trust</div>
          <div className="svc-desc">Identity and authentication for all Terra services. Phase 1: EC2 Security Group IP allowlist. Phase 2: Static API key (X-Terra-Api-Key header). Phase 3: JWT bearer token via dedicated Terra Auth service — stateless validation against public key, no DB round-trip on Terra API's side.</div>
          <div className="svc-principle"><strong>Principle:</strong> Centralized trust. Services verify identity through Terra API. But each service must remain independently operable if Terra API's auth layer is degraded — graceful degradation over hard dependency.</div>
        </div>

        <div className="svc-card">
          <div className="svc-label">Service 2</div>
          <div className="svc-title">Observability &amp; Audit Log</div>
          <div className="svc-desc">Every inter-service call passes through Terra API — making a tamper-evident, append-only audit log a near-zero-cost byproduct of normal operation (ADR-007). Correlation ID chain links related events across service boundaries. Cross-product metrics feed into PIOS's signal layer. Observability by default per Engineering Principle 8.1.</div>
          <div className="svc-principle"><strong>Why here:</strong> The gateway is the only place in the ecosystem where 100% of inter-service traffic is visible. An audit bus built into any individual service would be partial and incomplete.</div>
        </div>

        <div className="svc-card">
          <div className="svc-label">Service 3</div>
          <div className="svc-title">Health &amp; Isolation</div>
          <div className="svc-desc">Sidecar heartbeat registry across all Terra services. Graduated health state transitions — a service moves through states before quarantine. On quarantine: inter-service token issuance suspended, event bus writes blocked for the affected service (ADR-005). Blast radius containment — a compromised or failing service is cut off at the foundation without cascading.</div>
          <div className="svc-principle"><strong>See Health &amp; Isolation tab</strong> for the full state machine and quarantine mechanics.</div>
        </div>

        <div className="svc-card">
          <div className="svc-label">Service 4</div>
          <div className="svc-title">Feature Flags</div>
          <div className="svc-desc">YAML-driven, hot-reload feature flags served as a read-only API to all Terra subsidiary services (ADR-008). Single authoritative source — change the YAML, all consumers pick it up on next poll without redeployment. Enables safe, coordinated feature rollouts across the ecosystem without per-service deployment events.</div>
          <div className="svc-principle"><strong>Principle 4.1:</strong> Domain services remain sovereign — feature flags enable coordinated capability gating without centralizing decision logic.</div>
        </div>

        <div className="svc-card">
          <div className="svc-label">Service 5</div>
          <div className="svc-title">Billing Primitives</div>
          <div className="svc-desc">Subscription management and payment processor abstraction shared across all products. OMS SaaS fees, PIOS governance fees, Terra Nkap card issuance — all route through one billing primitive layer. Product-specific pricing logic, discount rules, and billing terms stay in each product's domain. Swap payment processors without touching product code.</div>
          <div className="svc-principle"><strong>Principle 4.3:</strong> Billing primitives live here. Billing decisions live in each product domain. The boundary is explicit.</div>
        </div>

        <div className="svc-card">
          <div className="svc-label">Service 6</div>
          <div className="svc-title">Notifications</div>
          <div className="svc-desc">Email, push, and SMS delivery infrastructure shared across all customer-facing products. OMS operator alerts, PIOS kill-switch notifications (ADR-014), Terra Nkap tier upgrade confirmations — all route through one notification layer. Notification content, templates, and trigger logic stay in each product's domain.</div>
          <div className="svc-principle"><strong>DRY at the enterprise level:</strong> Three products independently integrating Twilio, FCM, and SendGrid is unnecessary cost and maintenance surface.</div>
        </div>
      </div>
    </div>
  );
}
