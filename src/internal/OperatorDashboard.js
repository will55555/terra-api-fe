import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { resolveCustomerTier, applyTierVars } from '../config/tierTheme';
import EcosystemVisualizer from '../visualizer/EcosystemVisualizer';
import useOperatorEcosystem from './useOperatorEcosystem';
import OperatorServiceTable from './OperatorServiceTable';
import '../pages/dashboard.css';
import './operator.css';

// terra-api-adr-012 — the operator surface, at /internal.
//
// A separate ROUTE inside terra-api-fe rather than a separate app (reuses auth, theming, the
// Three.js scene, the polling pattern) and rather than conditional sections on the customer
// page (a bug in a `{role === 'internal' && …}` conditional is a data leak; a route boundary
// is coarser and more auditable).
//
// Layout is deliberate: lattice first, table below. The cubes answer "is anything wrong" at a
// glance; the table answers "what, why, since when, who is affected" — detail a 3D scene
// cannot carry. Neither alone is sufficient during an incident.
//
// Visually distinct from the customer dashboard on purpose. Same design system, but the
// operator accent is fixed rather than tier-driven, and the header says OPERATOR. Someone with
// both dashboards open should never have to look twice to know which one they are acting in.
export default function OperatorDashboard() {
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const {
    services,
    statusByServiceId,
    ecosystemStatus,
    servicesReporting,
    error,
    forbidden,
    isInitialLoad,
  } = useOperatorEcosystem();

  // The operator surface uses a fixed accent, NOT a customer tier: an operator has no Nkap
  // standing, and colouring this page by one would be meaningless. Reuses the tier plumbing so
  // there is one mechanism rather than two ways of setting --accent.
  useEffect(() => {
    applyTierVars({
      id: 'operator',
      name: 'Operator',
      accent: '#60a5fa',
      accentDim: 'rgba(96, 165, 250, 0.18)',
      accentGlow: 'rgba(96, 165, 250, 0.10)',
    });

    // Restore the customer default on unmount — otherwise navigating back to the customer
    // dashboard leaves it wearing the operator accent until its own effect re-runs.
    return () => applyTierVars(resolveCustomerTier(null));
  }, []);

  // 403 means authenticated-but-not-an-operator. Distinct from a feed failure, and worth
  // saying plainly: the alternative is an empty page that reads as broken.
  if (forbidden) {
    return (
      <div className="command-matrix op-shell">
        <div className="op-denied">
          <span className="op-denied-title">OPERATOR ACCESS REQUIRED</span>
          <p className="op-denied-note">
            This account is authenticated but lacks operator scope. Server-side authorization
            rejected the request — this page cannot show you data regardless of routing.
          </p>
          <button type="button" className="cm-signout" onClick={logout}>SIGN OUT</button>
        </div>
      </div>
    );
  }

  return (
    <div className="command-matrix op-shell">
      <header className="cm-header">
        <div className="cm-brand">
          <span className="cm-logo-title">Terra</span>
          <span className="cm-nav-badge op-badge">OPERATOR</span>
          <span className="cm-tier-badge">
            <span className="cm-tier-dot" />
            {servicesReporting} REPORTING
          </span>
        </div>
        <div className="cm-user-nav">
          <button
            type="button"
            className="cm-theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? '☀' : '☾'} THEME
          </button>
          <button type="button" className="cm-signout" onClick={logout}>SIGN OUT</button>
        </div>
      </header>

      <main className="cm-grid">
        <section className="cm-card">
          <div className="cm-card-header">
            <span className="cm-card-title">{'// '}ECOSYSTEM TOPOLOGY — ALL SERVICES</span>
            <span className="cm-card-status">
              {isInitialLoad && 'SYNCING…'}
              {!isInitialLoad && error && 'FEED UNAVAILABLE'}
              {/* Raw operator vocabulary, untranslated. "quarantined" is exactly the
                  distinction an operator is looking for and precisely what the customer view
                  deliberately softens away. */}
              {!isInitialLoad && !error && ecosystemStatus && ecosystemStatus.toUpperCase()}
            </span>
          </div>
          {/* Unfiltered by entitlement — LAYOUT_MODE is 'lattice', so every domain renders and
              the health colours come from the operator feed rather than the customer one. */}
          <EcosystemVisualizer statusByServiceId={statusByServiceId} error={error} />
        </section>

        <section className="cm-card">
          <div className="cm-card-header">
            <span className="cm-card-title">{'// '}SERVICE DETAIL</span>
          </div>
          <OperatorServiceTable services={services} />
        </section>
      </main>
    </div>
  );
}