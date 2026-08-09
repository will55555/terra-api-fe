import React from 'react';

// Migrated verbatim (markup + copy) from terra-hq-site/terra_api_strategy.html's
// #view-eco-architecture, 2026-08-09.
export default function EcosystemArchitectureTab() {
  return (
    <>
      <div className="eco-hero">
        <div className="eco-hero-title">HOW IT WORKS</div>
        <div className="eco-hero-sub">Technical Architecture &amp; Services</div>
        <div className="eco-hero-desc">Terra's infrastructure is built for scale, resilience, and rapid iteration. Every service integrates through a unified API gateway with cryptographic identity and event-driven coordination.</div>
      </div>

      <div className="block">
        <div className="sh"><span className="sh-index">14</span><span className="sh-title">Service Layers</span><span className="sh-line" /></div>
        <div className="eco-timeline">
          <div className="eco-timeline-item"><div className="eco-timeline-phase">Foundation</div><div className="eco-timeline-desc"><strong>Terra API</strong> — Centralized trust layer. Manages identity, health/quarantine monitoring, an audit log bus, and billing primitives. All services authenticate here and emit state changes through the audit log.</div></div>
          <div className="eco-timeline-item"><div className="eco-timeline-phase">Commerce</div><div className="eco-timeline-desc"><strong>ROMS</strong> (Route &amp; Order Management) — Real-time order orchestration, inventory sync, delivery coordination. Powers retail, marketplaces, and logistics across all properties.</div></div>
          <div className="eco-timeline-item"><div className="eco-timeline-phase">Investment</div><div className="eco-timeline-desc"><strong>PIOS</strong> (Personal Investment OS) — Transparent capital governance. Users see exactly where investments go, get automated distributions, and can participate in venture decisions.</div></div>
          <div className="eco-timeline-item"><div className="eco-timeline-phase">Domains</div><div className="eco-timeline-desc"><strong>Business Verticals</strong> — Finance, Hospitality, Real Estate, Agriculture, Apparel, Ventures. Each operates its own logic but shares identity, events, and billing through the foundation.</div></div>
        </div>
        <div className="callout"><strong>Why this design?</strong> Centralized trust prevents fraud. Decentralized execution prevents bottlenecks. Event-driven coordination keeps services loosely coupled and resilient.</div>
      </div>

      <div className="block">
        <div className="sh"><span className="sh-index">15</span><span className="sh-title">Deployment Strategy</span><span className="sh-line" /></div>
        <div className="eco-grid-3">
          <div className="eco-card"><div className="eco-card-title">Phase 1</div><div className="eco-card-desc">Foundation + Dashboard. Terra API and ROMS deployed and live. PIOS remains design-phase only — ADRs accepted, no code or deployment yet. Web dashboards for observability.</div></div>
          <div className="eco-card"><div className="eco-card-title">Phase 2</div><div className="eco-card-desc">Business verticals go live. Real estate, hospitality, finance, agriculture services deploy and integrate.</div></div>
          <div className="eco-card"><div className="eco-card-title">Phase 3+</div><div className="eco-card-desc">Scale &amp; optimize. Payment rails, AI features, international expansion, and institutional integrations.</div></div>
        </div>
      </div>
    </>
  );
}
