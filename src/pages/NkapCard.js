import React from 'react';
import TierCorners from './TierCorners';

// Nkap treasury card — Concept AB's top-right, 40% of the split.
//
// The 5-tier ladder and its colour mapping are real design decisions (recorded 2026-08-01):
// Silver #E2E8F0, Gold var(--gold), Platinum var(--teal), Diamond var(--purple),
// Sapphire var(--blue). Those are ported faithfully.
//
// The BALANCE is not. The reference shows "◈ 142,850.00" and a progress bar toward the next
// tier — both mockup filler, and there is no Nkap backend to replace them with. Rendering a
// number here would tell a customer they hold coins they do not. So the card renders its real
// structure with the balance region explicitly marked unwired: the layout is correct and
// ready, the figure arrives when something can compute it.

export const NKAP_TIERS = [
  { id: 'silver', name: 'Silver', color: '#E2E8F0' },
  { id: 'gold', name: 'Gold', color: 'var(--gold)' },
  { id: 'platinum', name: 'Platinum', color: 'var(--teal)' },
  { id: 'diamond', name: 'Diamond', color: 'var(--purple)' },
  { id: 'sapphire', name: 'Sapphire', color: 'var(--blue)' },
];

export default function NkapCard({ currentTierId = null }) {
  return (
    <div className="cm-card cm-nkap-card">
      <TierCorners />
      <div className="cm-card-header">
        <span className="cm-card-title">{'// '}YOUR NKAP</span>
      </div>

      <div className="cm-nkap-balance-region">
        <div className="cm-nkap-balance-placeholder">◈ ——————</div>
        <div className="cm-nkap-sub">NKAP LAUNCHING SOON</div>
      </div>

      {/* The tier ladder is real and worth showing even without a balance: it communicates
          the product's structure, which is the card's other job besides reporting a number. */}
      <div className="cm-nkap-tiers">
        {NKAP_TIERS.map((tier) => (
          <div
            key={tier.id}
            className={`cm-nkap-tier${tier.id === currentTierId ? ' is-current' : ''}`}
          >
            <span className="cm-nkap-tier-dot" style={{ background: tier.color }} />
            <span className="cm-nkap-tier-name">{tier.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
