import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { isOperator } from '../services/authService';
import { Link } from 'react-router-dom';
import { resolveCustomerTier, applyTierVars } from '../config/tierTheme';
import { useTheme } from '../context/ThemeContext';
import EcosystemVisualizer from '../visualizer/EcosystemVisualizer';
import useEcosystemHealth from '../visualizer/useEcosystemHealth';
import ProductLaunchpad from './ProductLaunchpad';
import NkapCard from './NkapCard';
import TierCorners from './TierCorners';
import './dashboard.css';

// The Command Matrix — terra-api-adr-009 Phase 4, Concept AB layout (accepted 2026-08-01,
// static reference in terra-api-fe/design-reference/).
//
// All four regions of the reference are ported: topology visualizer, Nkap treasury card,
// product launchpad, activity ledger. Layout and copy are faithful to the design; the
// mockup's invented figures ("MANAGED UNITS: 12", "Waitlist Position: #142", a treasury
// balance) are NOT carried over. Showing a customer numbers that mean nothing is worse than
// showing a region honestly marked unwired.
//
// The health poll lives HERE, not inside the visualizer, because two regions consume it —
// the topology and the launchpad's live service state. One poll, one source of truth, so a
// product card and its cube can never disagree about whether something is running.
// The endpoint returns operator vocabulary (healthy|degraded|critical) because the same tier
// logic serves /actuator/ecosystem-health. A customer should read about THEIR products, not
// about "the ecosystem" — and "CRITICAL" is alarming language for someone who cannot act on
// it. Translated at the edge rather than in the API, so the operator view keeps its precision.
function customerStatusLabel(status) {
  switch (status) {
    case 'healthy':
      return 'ALL SYSTEMS NORMAL';
    case 'degraded':
      return 'SOME SERVICES DEGRADED';
    case 'critical':
      return 'SERVICE DISRUPTION';
    default:
      return '';
  }
}

export default function Dashboard() {
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { statusByServiceId, customerStatus, error, isInitialLoad } = useEcosystemHealth();

  // Robinhood-Gold-style tier accent: the customer's membership tier colours the whole
  // surface rather than a single fixed brand colour. Written as CSS custom properties on
  // :root, so every component picks it up via var(--accent) without knowing tiers exist.
  //
  // Passing null is deliberate — no backend exposes an Nkap tier yet, so resolveCustomerTier
  // returns the Gold default. Faking a tier here would be inventing a customer's standing;
  // when the field lands, this call takes the profile and every surface follows.
  const tier = resolveCustomerTier(null);

  useEffect(() => {
    applyTierVars(tier);
  }, [tier]);

  return (
    <div className="command-matrix">
      <header className="cm-header">
        <div className="cm-brand">
          <span className="cm-logo-title">Terra</span>
          <span className="cm-nav-badge">MEMBER DASHBOARD</span>
          {/* Membership standing, Robinhood-Gold style: persistent, accent-filled, and the
              thing that makes the page-wide accent legible as a TIER rather than as an
              arbitrary brand colour. */}
          <span className="cm-tier-badge">
            <span className="cm-tier-dot" />
            {tier.name}
          </span>
        </div>
        <div className="cm-user-nav">
          {/* Same affordance as terra-hq-site's theme toggle — the icon shows what you get
              by clicking, not what you currently have. */}
          <button
            type="button"
            className="cm-theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? '☀' : '☾'} THEME
          </button>
          {/* Only rendered for operators — a customer has no reason to see a link to a page
              they would be redirected away from. Not a security measure: the route exists in
              the bundle regardless, and the server is what refuses the data. */}
          {isOperator() && (
            <Link to="/internal" className="cm-theme-toggle">OPERATOR</Link>
          )}
          <button type="button" className="cm-signout" onClick={logout}>
            SIGN OUT
          </button>
        </div>
      </header>

      <main className="cm-grid">
        {/* Top row: 60/40 split — topology left, Nkap right. */}
        <section className="cm-top-row">
          <div className="cm-card">
            <TierCorners />
            <div className="cm-card-header">
              <span className="cm-card-title"><span className="cm-card-index">01</span>{'// '}YOUR ECOSYSTEM</span>
              <span className="cm-card-status">
                {isInitialLoad && 'SYNCING…'}
                {!isInitialLoad && error && 'STATUS UNAVAILABLE'}
                {!isInitialLoad && !error && customerStatus &&
                  customerStatusLabel(customerStatus)}
              </span>
            </div>
            <EcosystemVisualizer statusByServiceId={statusByServiceId} error={error} />
          </div>

          <NkapCard currentTierId={tier.id} />
        </section>

        <section className="cm-card">
          <TierCorners />
          <div className="cm-card-header">
            <span className="cm-card-title"><span className="cm-card-index">02</span>{'// '}YOUR PRODUCTS</span>
          </div>
          <ProductLaunchpad statusByServiceId={statusByServiceId} />
        </section>

        <section className="cm-card cm-placeholder">
          <div className="cm-card-header">
            <span className="cm-card-title"><span className="cm-card-index">03</span>{'// '}RECENT ACTIVITY</span>
          </div>
          <p className="cm-placeholder-note">
            Activity history coming soon
          </p>
        </section>
      </main>
    </div>
  );
}
