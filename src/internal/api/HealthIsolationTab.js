import React from 'react';

// Migrated verbatim (markup + copy) from terra-hq-site/terra_api_strategy.html's
// #view-isolation, 2026-08-09.
export default function HealthIsolationTab() {
  return (
    <>
      <div className="block">
        <div className="sh"><span className="sh-index">06</span><span className="sh-title">Health Orchestration &amp; Service Isolation</span><span className="sh-line" /><span className="sh-note">ADR-005 · Phase 3</span></div>
        <div className="callout red">
          <strong>The quarantine capability:</strong> Terra API runs a sidecar heartbeat registry. Every Terra service reports heartbeats to Terra API. When a service misses heartbeats — due to failure, compromise, or rogue behavior — it moves through graduated health states until quarantined. At quarantine, Terra API cuts that service's access to the ecosystem: inter-service token issuance is suspended and event bus writes are blocked. The service is isolated without bringing down the rest of the ecosystem.
        </div>
        <div className="callout">
          <strong>Why this lives in the foundation layer:</strong> A compromised service that can still issue tokens and publish events can do damage proportional to its privileges in the ecosystem. Isolation at the foundation layer is the only place where that blast radius can be contained — individual services cannot cut each other off. Only the foundation layer has the authority to do that.
        </div>
      </div>

      <div className="block">
        <div className="sh"><span className="sh-index">07</span><span className="sh-title">Health State Machine</span><span className="sh-line" /></div>
        <div className="health-flow">
          <div className="hf-row">
            <div className="hf-state" style={{ color: 'var(--green)' }}>Healthy</div>
            <div className="hf-desc">Service is reporting heartbeats on schedule. Full ecosystem access. Normal token issuance, full event bus participation.</div>
          </div>
          <div className="hf-row">
            <div className="hf-state" style={{ color: 'var(--amber)' }}>Degraded</div>
            <div className="hf-desc">Service has missed one or more heartbeats but within tolerance. Alert generated. Ecosystem access maintained. Operator notified.</div>
          </div>
          <div className="hf-row">
            <div className="hf-state" style={{ color: 'var(--orange)' }}>Suspect</div>
            <div className="hf-desc">Heartbeat misses exceed threshold. Read-only mode considered. Terra API logs all activity from this service with elevated priority. Other services are notified the source is suspect.</div>
          </div>
          <div className="hf-row">
            <div className="hf-state" style={{ color: 'var(--red)' }}>Quarantined</div>
            <div className="hf-desc"><strong>Blast radius containment active.</strong> Inter-service token issuance suspended for this service — it can no longer authenticate to other Terra services. Event bus write access blocked — it can no longer publish events to the ecosystem. Service is isolated. Its own operations may continue locally, but it is cut off from the shared infrastructure. Quarantine requires explicit manual release by an authorized operator.</div>
          </div>
        </div>
      </div>

      <div className="block">
        <div className="sh"><span className="sh-index">08</span><span className="sh-title">Independence During Isolation</span><span className="sh-line" /></div>
        <div className="callout gold">
          <strong>Critical design constraint (Principle 4.4):</strong> When a service is quarantined, the other services must continue operating normally. The quarantine of SYS-OMS must not affect SYS-PIOS or any other service. Terra API's health orchestration is designed to contain the blast radius of the affected service — not to amplify it across the ecosystem. The quarantine is a scalpel, not a circuit breaker for the whole system.
        </div>
        <div className="callout">
          <strong>What services must do for this to work:</strong> Each service must be designed to operate independently when its shared infrastructure calls fail or are unavailable. A service that hard-depends on Terra API for every operation cannot be isolated safely — isolating it would break everything upstream. Engineering Principle 4.2 enforces this: &quot;Shared systems may enhance capabilities, but must never prevent services from operating independently.&quot;
        </div>
      </div>
    </>
  );
}
