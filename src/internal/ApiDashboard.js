import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import HeartbeatBackdrop from './HeartbeatBackdrop';
import OverviewTab from './api/OverviewTab';
import OperatorTab from './api/OperatorTab';
import CoreServicesTab from './api/CoreServicesTab';
import HealthIsolationTab from './api/HealthIsolationTab';
import BuildSequenceTab from './api/BuildSequenceTab';
import AdrsTab from './api/AdrsTab';
import EcosystemPublicTab from './api/EcosystemPublicTab';
import EcosystemArchitectureTab from './api/EcosystemArchitectureTab';
import ForPartnersTab from './api/ForPartnersTab';
// dashboard.css is imported for its :root tokens only (--font-mono, --text-dim, --accent, etc.)
// — operator.css and OperatorTab's markup depend on them. Its .command-matrix rules don't
// apply here since this page no longer uses that class (api-dashboard.css defines .api-shell's
// own look, copied verbatim from terra_api_strategy.html — see that file's header comment).
import '../pages/dashboard.css';
import './operator.css';
import './api-dashboard.css';

// Terra API's own internal front-end/UI surface, at /internal — the single operator surface in
// this app (2026-08-09: the old standalone /internal route, OperatorDashboard.js, was folded
// in here as the Operator tab rather than kept as a second top-level page. Both shared the same
// audience — role=internal — and Terra API's own UI already had the tab affordance, so a
// separate header/nav/route was redundant, not load-bearing. This component briefly lived at
// /internal/api since it was the surviving file, but every other link in the app already
// pointed at /internal, so the route moved back rather than updating every caller.)
//
// The Overview/Core Services/Health/Build/ADRs/Ecosystem/Partners tabs were migrated from
// terra-hq-site/terra_api_strategy.html, which stays in that repo as a frozen local reference
// copy rather than being kept in hand-maintained sync going forward.
//
// Reuses OperatorRoute for auth gating (role=internal). See OperatorRoute.js for why that's a
// routing convenience, not a security boundary — the real gate is server-side.
//
// The last 3 content tabs (Ecosystem Public, Ecosystem Architecture, For Partners) are
// public-marketing/partner-facing copy, not internal-engineering documentation like the rest,
// but kept here per Will's explicit call to match terra_api_strategy.html's full source
// structure rather than split them onto a separate surface.
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'operator', label: 'Operator' },
  { id: 'core-services', label: 'Core Services' },
  { id: 'health-isolation', label: 'Health & Isolation' },
  { id: 'build-sequence', label: 'Build Sequence' },
  { id: 'adrs', label: 'ADRs' },
  { id: 'ecosystem-public', label: 'Ecosystem (Public)' },
  { id: 'ecosystem-architecture', label: 'Ecosystem Architecture' },
  { id: 'for-partners', label: 'For Partners' },
];

export default function ApiDashboard() {
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('overview');
  // Mobile-only tab drawer (2026-08-09, Will's ask — no HTML source equivalent; the static page
  // just lets its 9 tabs horizontally scroll below the 768px breakpoint). Closed by default;
  // toggled by the hamburger button that only renders at that same breakpoint via CSS.
  const [menuOpen, setMenuOpen] = useState(false);

  const selectTab = (id) => {
    setActiveTab(id);
    setMenuOpen(false);
  };

  return (
    <div className="api-shell">
      <HeartbeatBackdrop />

      {/* nav — matches terra_api_strategy.html's <nav> verbatim in structure, swapping the
          HTML's static "TERRA HQ" link + Cloudflare live-badge for this app's real auth/theme
          controls, since those concepts don't exist in the static page. The "FOUNDATION LAYER"
          badge (the HTML's live-status equivalent) was dropped 2026-08-09 per Will's request —
          not replaced with anything, this app has no equivalent live-status concept to show. */}
      <nav className="nav-brand-bar">
        <div className="nav-left">
          {/* Placeholder for a real logo (2026-08-09, Will's call) — likely animated, design
              TBD. Kept as an honest, clearly-labeled placeholder rather than a plain "TERRA
              API" text wordmark standing in as if it were final, same principle as Login.js's
              social-login placeholder buttons (see that file's own comment). Swap the whole
              span for the real mark/animation when it exists; nav-brand-placeholder's CSS is
              deliberately plain (dashed outline) so it reads as "not built yet," not as a
              design choice. */}
          <span className="nav-brand nav-brand-placeholder" title="Logo placeholder — design TBD">LOGO</span>
        </div>
        <div className="nav-right">
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title="Toggle theme"
          >
            <span className="theme-icon">{theme === 'dark' ? '☀' : '☾'}</span>
          </button>
          <button type="button" className="theme-toggle nav-signout" onClick={logout} title="Sign out">⏻</button>
          {/* Always visible at every width (2026-08-09, Will's call — not gated behind the
              768px breakpoint like the first version was; moved from the left side to here
              2026-08-09 per Will's follow-up). Opens the same tab drawer the tab bar itself
              still shows underneath — an additional quick-access control, not a replacement
              for the horizontal bar at desktop width. */}
          <button
            type="button"
            className="theme-toggle nav-menu-toggle"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            title="Menu"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      <div className="api-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`api-tab${activeTab === tab.id ? ' api-tab-active' : ''}`}
            onClick={() => selectTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {menuOpen && (
        // Same tab set as the horizontal bar above, just re-rendered as a vertical drawer for
        // narrow viewports — role="tablist"/"tab" (matching that bar) rather than "menu", since
        // this is a second presentation of the same tab-selection control, not an actions menu.
        <div className="api-tab-drawer" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`api-tab-drawer-item${activeTab === tab.id ? ' api-tab-drawer-item-active' : ''}`}
              onClick={() => selectTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div className="api-content">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'operator' && <OperatorTab />}
        {activeTab === 'core-services' && <CoreServicesTab />}
        {activeTab === 'health-isolation' && <HealthIsolationTab />}
        {activeTab === 'build-sequence' && <BuildSequenceTab />}
        {activeTab === 'adrs' && <AdrsTab />}
        {activeTab === 'ecosystem-public' && <EcosystemPublicTab />}
        {activeTab === 'ecosystem-architecture' && <EcosystemArchitectureTab />}
        {activeTab === 'for-partners' && <ForPartnersTab />}
      </div>
    </div>
  );
}
