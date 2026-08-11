import React from 'react';

// Migrated verbatim (markup + copy) from terra-hq-site/terra_api_strategy.html's
// #view-eco-ecosystem, 2026-08-09.
export default function EcosystemPublicTab() {
  return (
    <>
      <div className="eco-hero">
        <div className="eco-hero-title">TERRA ECOSYSTEM</div>
        <div className="eco-hero-sub">Unified Commerce &amp; Investment Platform</div>
        <div className="eco-hero-desc">
          Terra is a vertically integrated ecosystem connecting global commerce, regional finance, and personal investment. We build infrastructure that empowers individuals and communities across Africa and beyond.
        </div>
        <div className="eco-pills">
          <span className="eco-pill">Commerce</span>
          <span className="eco-pill">Finance</span>
          <span className="eco-pill">Technology</span>
          <span className="eco-pill">Investment</span>
        </div>
      </div>

      <div className="block">
        <div className="sh"><span className="sh-index">12</span><span className="sh-title">What We Do</span><span className="sh-line" /></div>
        <div className="eco-grid-2">
          <div className="eco-card">
            <div className="eco-card-title">Commerce Engine</div>
            <div className="eco-card-desc">Order Management System (OMS) powers retail, delivery, and marketplace operations across all Terra properties. Real-time order tracking, inventory sync, and fulfillment orchestration.</div>
          </div>
          <div className="eco-card">
            <div className="eco-card-title">Investment OS</div>
            <div className="eco-card-desc">Personal Investment OS (PIOS) enables individuals to participate in Terra ventures and earn on capital. Transparent governance, automated distributions, and portfolio management in one platform.</div>
          </div>
          <div className="eco-card">
            <div className="eco-card-title">Foundation Layer</div>
            <div className="eco-card-desc">Terra API is the shared services hub: unified authentication, health/quarantine reporting, rate limiting, an audit log bus, feature flags, and billing primitives. All business domains plug into this foundation.</div>
          </div>
          <div className="eco-card">
            <div className="eco-card-title">Regional Strategy</div>
            <div className="eco-card-desc">Terra Africa operates resorts, agritech, and retail across West Africa. Terra Nkap is our payment ecosystem and digital currency system. Terra Ventures manages capital allocation.</div>
          </div>
        </div>
      </div>

      <div className="block">
        <div className="sh"><span className="sh-index">13</span><span className="sh-title">Core Principles</span><span className="sh-line" /></div>
        <div className="eco-principles">
          <div className="eco-principle"><div className="eco-principle-icon">🌍</div><div><div className="eco-principle-title">Distributed by Design</div><div className="eco-principle-desc">Each business operates independently yet connects through a shared API layer, avoiding centralized bottlenecks.</div></div></div>
          <div className="eco-principle"><div className="eco-principle-icon">🔐</div><div><div className="eco-principle-title">Trust-First Architecture</div><div className="eco-principle-desc">Cryptographic identity and transparent governance. Investors, partners, and users know exactly how capital flows.</div></div></div>
          <div className="eco-principle"><div className="eco-principle-icon">⚡</div><div><div className="eco-principle-title">Resilient Systems</div><div className="eco-principle-desc">Services degrade gracefully. If one component fails, others continue operating. No single point of failure.</div></div></div>
          <div className="eco-principle"><div className="eco-principle-icon">🚀</div><div><div className="eco-principle-title">Rapid Iteration</div><div className="eco-principle-desc">Modular architecture allows us to ship new verticals and features without rewriting the foundation.</div></div></div>
        </div>
      </div>
    </>
  );
}
