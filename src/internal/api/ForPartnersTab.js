import React from 'react';

// Migrated verbatim (markup + copy) from terra-hq-site/terra_api_strategy.html's
// #view-eco-partners, 2026-08-09.
export default function ForPartnersTab() {
  return (
    <>
      <div className="eco-hero">
        <div className="eco-hero-title">FOR PARTNERS</div>
        <div className="eco-hero-sub">Integration &amp; Opportunity</div>
        <div className="eco-hero-desc">Terra's API-first design makes it easy for partners to integrate. Build on our infrastructure or connect your services to the ecosystem.</div>
      </div>

      <div className="block">
        <div className="sh"><span className="sh-index">16</span><span className="sh-title">Integration Patterns</span><span className="sh-line" /></div>
        <div className="eco-grid-2">
          <div className="eco-card"><div className="eco-card-title">Webhooks &amp; Events</div><div className="eco-card-desc">Subscribe to order creation, payment completion, or inventory changes. React in real-time without polling. Event signatures ensure cryptographic security.</div></div>
          <div className="eco-card"><div className="eco-card-title">REST API</div><div className="eco-card-desc">Query orders, balances, user data, and business metrics. JWT-authenticated endpoints, with coverage expanding as the auth rollout continues. Standardized error handling and pagination.</div></div>
          <div className="eco-card"><div className="eco-card-title">Marketplace Integration</div><div className="eco-card-desc">Become a vendor on ROMS. Sync inventory, receive orders, and settle payments through the unified platform. No separate integrations required.</div></div>
          <div className="eco-card"><div className="eco-card-title">Capital Participation</div><div className="eco-card-desc">Invest in Terra ventures through PIOS. Transparent cap tables, automated distributions, and governance participation as a limited partner.</div></div>
        </div>
        <div className="callout"><strong>Getting started:</strong> Contact us at partnerships@terra-hq.com. We'll provide API credentials, sandbox access, and technical documentation tailored to your use case.</div>
      </div>

      <div className="block">
        <div className="sh"><span className="sh-index">17</span><span className="sh-title">Why Partner With Terra</span><span className="sh-line" /></div>
        <div className="eco-principles">
          <div className="eco-principle"><div className="eco-principle-icon">📊</div><div><div className="eco-principle-title">Transparency</div><div className="eco-principle-desc">No black boxes. You see order flows, payment settlement, and capital allocation in real time.</div></div></div>
          <div className="eco-principle"><div className="eco-principle-icon">💪</div><div><div className="eco-principle-title">Scale</div><div className="eco-principle-desc">Build on infrastructure that handles thousands of orders, millions in transaction volume, and complex distributed operations.</div></div></div>
          <div className="eco-principle"><div className="eco-principle-icon">🔄</div><div><div className="eco-principle-title">Flexibility</div><div className="eco-principle-desc">Webhooks, REST API, or direct database access. Choose the integration pattern that fits your workflow.</div></div></div>
          <div className="eco-principle"><div className="eco-principle-icon">🌱</div><div><div className="eco-principle-title">Growth</div><div className="eco-principle-desc">As Terra scales, your integration scales too. New features, markets, and services launch on the same foundation.</div></div></div>
        </div>
        <div className="callout"><strong>Support:</strong> Our engineering team is available for technical questions, custom integration planning, and performance optimization.</div>
      </div>
    </>
  );
}
