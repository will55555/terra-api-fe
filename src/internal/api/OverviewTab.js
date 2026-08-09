import React from 'react';
import EcosystemVisualizer from '../../visualizer/EcosystemVisualizer';
import useOperatorEcosystem from '../useOperatorEcosystem';

// Migrated verbatim (markup + copy) from terra-hq-site/terra_api_strategy.html's
// #view-overview, 2026-08-09. Class names (.api-hero, .stat-strip, .sh, .callout, .data-table,
// etc.) are copied as-is — see api-dashboard.css's own header comment for why.
//
// One deliberate substitution: the HTML's hero visualizer is an iframe embedding
// terra_api_visualizer_phase5.html (a separate vanilla-JS Three.js build). Will's explicit
// instruction was that the visualizer is "the only thing that doesn't need to move" — so this
// slot uses the same live EcosystemVisualizer React component OperatorTab already renders,
// not a ported iframe. Everything else on this tab (hero copy, stat cards, all 4 content
// blocks) is the HTML's actual text, unchanged.
export default function OverviewTab() {
  const { statusByServiceId, error } = useOperatorEcosystem();

  return (
    <>
      <div className="api-hero">
        <div style={{ fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '20px' }}>
          Interact: Hover for names · Drag to rotate · Click to scatter cubes
        </div>
        <div className="api-logo">TERRA API</div>
        <div className="api-sub">Foundation Layer · Not a Central Brain</div>
        <div className="hero-pills">
          <span className="hpill hp-b">Live in Production</span>
          <span className="hpill hp-a">Spring Boot 3.x · Java 21</span>
          <span className="hpill hp-c">9 ADRs Accepted</span>
        </div>
      </div>

      {/* margin/height trimmed from the HTML's 30px/40px/480px (2026-08-09), then cut further
          in a 2nd pass same day (420px → 360px, margins tightened) — combined with the hero's
          own 2nd-pass trim (api-dashboard.css), the goal is the full visualizer fitting above
          the fold on page load without scrolling, which the first round of cuts still didn't
          achieve. */}
      <div className="viz-frame" style={{ width: '80%', maxWidth: '1100px', margin: '8px auto 20px', height: '360px', position: 'relative', padding: 0, overflow: 'hidden', borderRadius: '6px' }}>
        {/* transparent: true — this is the one deliberate deviation from a literal port (per
            Will: only the visualizer's BACKGROUND needs to match the HTML, not the whole
            component). The HTML's hero visualizer is a transparent iframe so .viz-frame's
            frosted-glass panel (and the circuit backdrop behind it) shows through; without this
            EcosystemVisualizer painted its own opaque dark THREE.Color, hiding the frame
            entirely. See terraScene.js's createScene() for the actual mechanism. */}
        <EcosystemVisualizer statusByServiceId={statusByServiceId} error={error} transparent />
      </div>

      <div className="stat-strip">
        <div className="scard"><div className="sval">9</div><div className="slabel">ADRs Accepted</div></div>
        <div className="scard"><div className="sval">6</div><div className="slabel">Core Services</div></div>
        <div className="scard"><div className="sval">SB</div><div className="slabel">Spring Boot 3.x · Java 21</div></div>
        <div className="scard"><div className="sval">EC2</div><div className="slabel">AWS · Phase 1 shared with ROMS</div></div>
      </div>

      <div className="block">
        <div className="sh"><span className="sh-index">01</span><span className="sh-title">What Terra API Is</span><span className="sh-line" /></div>
        <div className="callout">
          Terra API is the <strong>Foundation Layer</strong> for the entire Terra Inc ecosystem — a shared infrastructure platform built in Spring Boot 3.x (Java 21) that provides auth/trust, observability, health orchestration, feature flags, billing primitives, and notifications as platform-level services consumed by all Terra subsidiaries (ROMS, PIOS, Terra Nkap, Terra Apparel, etc.). It is not a product. It has no customers. It has no external revenue. It is what transforms five independent companies-under-one-brand into an actual ecosystem.
        </div>
        <div className="callout gold">
          <strong>Why the Foundation Layer matters:</strong> Without it, every Terra product independently builds auth, billing, notifications, and observability — creating divergence, duplication, and coupling that makes individual vertical exits or spin-offs structurally impossible. The Foundation Layer eliminates that duplication while preserving the independence of each domain service. The holding company model (Terra Inc → subsidiaries) only works long-term if each subsidiary can be operated, sold, or spun off independently — Terra API is what makes that possible at the technical level.
        </div>
        <div className="callout teal">
          <strong>Centralized Trust, Decentralized Survivability (Core Design Principle):</strong> Terra API centralizes trust mechanisms — authentication, identity, security standards. But operational continuity remains decentralized. A failure in Terra API must not collapse independent product domains. Every service must degrade gracefully when Terra API is degraded or unavailable. Shared infrastructure exists to strengthen services, not imprison them.
        </div>
      </div>

      <div className="block">
        <div className="sh"><span className="sh-index">02</span><span className="sh-title">Service Identity</span><span className="sh-line" /></div>
        <table className="data-table">
          <tbody>
            <tr><th>Field</th><th>Value</th></tr>
            <tr><td style={{ color: 'var(--text)' }}>Classification</td><td>Foundation Service — Platform (TSAM: SYS-TERRA-API)</td></tr>
            <tr><td style={{ color: 'var(--text)' }}>Layer</td><td>API Layer · Criticality: High</td></tr>
            <tr><td style={{ color: 'var(--text)' }}>Technology</td><td>Spring Boot 3.x, Java 21, Gradle</td></tr>
            <tr><td style={{ color: 'var(--text)' }}>Port (local dev / EC2)</td><td>8080 / 8080 · Management: 8082 (Actuator only) · Public HTTPS: api.terra-hq.com (Cloudflare-proxied)</td></tr>
            <tr><td style={{ color: 'var(--text)' }}>Host (Phase 1–2)</td><td>Shared EC2 t2.small (Ubuntu) — same instance as ROMS</td></tr>
            <tr><td style={{ color: 'var(--text)' }}>Host (Phase 3+)</td><td>Separate EC2 instance when load warrants</td></tr>
            <tr><td style={{ color: 'var(--text)' }}>State model</td><td>Stateless in Phase 1–2 — Caffeine in-memory cache, no persistent DB; Phase 3 adds persistent audit log store</td></tr>
            <tr><td style={{ color: 'var(--text)' }}>Why Spring Boot</td><td>ROMS infrastructure reuse (same EC2, same Jenkins CI/CD, same stack expertise at production level). Zero new infrastructure for Phase 1. ADR-001.</td></tr>
            <tr><td style={{ color: 'var(--text)' }}>ADRs</td><td>ADR-001 through ADR-009 — all accepted</td></tr>
          </tbody>
        </table>
      </div>

      <div className="block">
        <div className="sh"><span className="sh-index">03</span><span className="sh-title">What It Owns vs. Does Not Own</span><span className="sh-line" /></div>
        <table className="data-table">
          <tbody>
            <tr>
              <th style={{ width: '50%' }}>Terra API Owns</th>
              <th>No Service, Including Terra API, Owns</th>
            </tr>
            <tr>
              <td>
                Auth/identity trust infrastructure<br /><br />
                Interoperability primitives (contracts, versioning)<br /><br />
                Observability and audit log bus<br /><br />
                Ecosystem health registry and quarantine enforcement<br /><br />
                Feature flag service<br /><br />
                Rate limiting at the gateway entry point<br /><br />
                Billing primitives<br /><br />
                Notification infrastructure<br /><br />
                Event bus routing
              </td>
              <td>
                Domain business logic (ROMS orders, PIOS capital rules, Terra Nkap tier mechanics)<br /><br />
                Domain source-of-truth data<br /><br />
                Cross-domain direct database access<br /><br />
                Decisions that belong to individual product domains
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="block">
        <div className="sh"><span className="sh-index">04</span><span className="sh-title">Design Principles</span><span className="sh-line" /></div>
        <table className="data-table">
          <tbody>
            <tr>
              <th style={{ width: '30%' }}>Principle</th><th>What It Means</th>
            </tr>
            <tr>
              <td><strong>Foundation Layer, Not Central Brain</strong></td>
              <td>Provides trust, interoperability, governance utilities — never owns product business logic. Services remain sovereign in their own domains.</td>
            </tr>
            <tr>
              <td><strong>Centralized Trust, Decentralized Survivability</strong></td>
              <td>Auth is centralized; operational continuity is not. Services survive Terra API degradation through graceful fallback and stale-cache mechanisms.</td>
            </tr>
            <tr>
              <td><strong>Blast Radius Containment</strong></td>
              <td>Quarantine isolates a compromised or failing service without cascading harm to the ecosystem. Only the foundation layer has authority to cut off access.</td>
            </tr>
            <tr>
              <td><strong>Domain Sovereignty</strong></td>
              <td>Each service owns its business logic, workflows, and source-of-truth data. Terra API provides infrastructure, not decisions.</td>
            </tr>
            <tr>
              <td><strong>Modular Before Distribution</strong></td>
              <td>Starts as a modular monolith on shared EC2; separates only when load and independent scaling justify it. No premature complexity.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
