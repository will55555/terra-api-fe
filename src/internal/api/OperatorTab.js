import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { resolveCustomerTier, applyTierVars } from '../../config/tierTheme';
import EcosystemVisualizer from '../../visualizer/EcosystemVisualizer';
import useOperatorEcosystem from '../useOperatorEcosystem';
import OperatorServiceTable from '../OperatorServiceTable';

// terra-api-adr-012 — the operator surface, merged into ApiDashboard as a tab (2026-08-09).
// Previously its own route at /internal (OperatorDashboard.js, now removed) — folded in once
// it became clear both surfaces share one audience (role=internal) and Terra API's own UI
// already has the tab affordance, so a second top-level route/header/nav was redundant rather
// than load-bearing.
//
// Layout is deliberate: lattice first, table below. The cubes answer "is anything wrong" at a
// glance; the table answers "what, why, since when, who is affected" — detail a 3D scene
// cannot carry. Neither alone is sufficient during an incident.
export default function OperatorTab() {
  const { logout } = useAuth();
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

    // Restore the customer default on unmount — otherwise switching to another tab (or
    // navigating away) leaves the page wearing the operator accent.
    return () => applyTierVars(resolveCustomerTier(null));
  }, []);

  // 403 means authenticated-but-not-an-operator. Distinct from a feed failure, and worth
  // saying plainly: the alternative is an empty tab that reads as broken. In practice this
  // shouldn't be reachable — OperatorRoute already gates the whole /internal page — but the
  // server-side check is the real boundary (see OperatorRoute.js), so this stays as defense in
  // depth rather than being deleted as "unreachable."
  if (forbidden) {
    return (
      <div className="op-denied">
        <span className="op-denied-title">OPERATOR ACCESS REQUIRED</span>
        <p className="op-denied-note">
          This account is authenticated but lacks operator scope. Server-side authorization
          rejected the request — this page cannot show you data regardless of routing.
        </p>
        <button type="button" className="cm-signout" onClick={logout}>SIGN OUT</button>
      </div>
    );
  }

  return (
    <>
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
            {!isInitialLoad && !error && ` · ${servicesReporting} REPORTING`}
          </span>
        </div>
        {/* Frosted-glass .viz-frame + transparent scene (2026-08-09, matching OverviewTab's
            hero visualizer) rather than visualizer.css's normal opaque .cm-visualizer card —
            Will wants the circuit backdrop showing through here too, not just on Overview.
            Unfiltered by entitlement — LAYOUT_MODE is 'lattice', so every domain renders and
            the health colours come from the operator feed rather than the customer one. */}
        <div className="viz-frame" style={{ height: '480px', position: 'relative', padding: 0, overflow: 'hidden', borderRadius: '6px' }}>
          <EcosystemVisualizer statusByServiceId={statusByServiceId} error={error} transparent />
        </div>
      </section>

      <section className="cm-card">
        <div className="cm-card-header">
          <span className="cm-card-title">{'// '}SERVICE DETAIL</span>
        </div>
        <OperatorServiceTable services={services} />
      </section>
    </>
  );
}
