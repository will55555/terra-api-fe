// Customer tier accent system — Robinhood-Gold-style, where the whole surface takes on the
// customer's tier colour rather than a single fixed brand accent.
//
// IMPORTANT — three different things in this codebase are called "tier", and conflating them
// causes real bugs:
//
//   1. customers.tier        — ADR-006 rate-limit generosity (internal|standard|restricted).
//                              Answers "how much can this caller do". NOT this.
//   2. QuarantineTier        — ADR-005 service health (HEALTHY|YELLOW|ORANGE|RED). Drives
//                              cube colour in the visualizer. NOT this either.
//   3. Nkap membership tier  — Silver|Gold|Platinum|Diamond|Sapphire. THIS one. A commercial
//                              standing, and the only one a customer would recognise.
//
// The backend does not expose #3 yet — there is no Nkap service. Until it does, the tier is
// resolved from a single place (resolveCustomerTier) so wiring it later is one function body,
// not a hunt through components.

export const NKAP_TIERS = {
  SILVER: {
    id: 'silver',
    name: 'Silver',
    accent: '#c0c6cf',
    accentDim: 'rgba(192, 198, 207, 0.18)',
    accentGlow: 'rgba(192, 198, 207, 0.10)',
  },
  GOLD: {
    id: 'gold',
    name: 'Gold',
    accent: '#c9a84c',
    accentDim: 'rgba(201, 168, 76, 0.18)',
    accentGlow: 'rgba(201, 168, 76, 0.10)',
  },
  PLATINUM: {
    id: 'platinum',
    name: 'Platinum',
    accent: '#2dd4bf',
    accentDim: 'rgba(45, 212, 191, 0.18)',
    accentGlow: 'rgba(45, 212, 191, 0.10)',
  },
  DIAMOND: {
    id: 'diamond',
    name: 'Diamond',
    accent: '#a78bfa',
    accentDim: 'rgba(167, 139, 250, 0.18)',
    accentGlow: 'rgba(167, 139, 250, 0.10)',
  },
  SAPPHIRE: {
    id: 'sapphire',
    name: 'Sapphire',
    accent: '#60a5fa',
    accentDim: 'rgba(96, 165, 250, 0.18)',
    accentGlow: 'rgba(96, 165, 250, 0.10)',
  },
};

export const TIER_ORDER = ['silver', 'gold', 'platinum', 'diamond', 'sapphire'];

// Gold is the default rather than Silver: Silver-as-default would make every unwired customer
// look like the lowest tier, which is a claim about their standing. Gold is the existing
// house accent from Concept AB, so an unresolved tier renders as the neutral brand look
// rather than as a demotion.
export const DEFAULT_TIER = NKAP_TIERS.GOLD;

/**
 * Resolve the customer's Nkap tier.
 *
 * Currently returns the default — no backend field exists. The seam is here so that when
 * Nkap ships, this reads from the health/profile payload and every surface follows
 * automatically.
 *
 * @param {object|null} profile Reserved for the future customer profile payload.
 */
export function resolveCustomerTier(profile) {
  const raw = profile?.nkap_tier;
  if (!raw) return DEFAULT_TIER;

  const match = NKAP_TIERS[String(raw).toUpperCase()];
  return match ?? DEFAULT_TIER;
}

/**
 * Push the tier accent into CSS custom properties on :root.
 *
 * Deliberately writes variables rather than swapping class names: every component already
 * reads --accent/--accent-dim/--accent-glow, so one write re-themes the entire page without
 * any component knowing tiers exist.
 */
export function applyTierVars(tier) {
  const root = document.documentElement;
  root.style.setProperty('--accent', tier.accent);
  root.style.setProperty('--accent-dim', tier.accentDim);
  root.style.setProperty('--accent-glow', tier.accentGlow);
  root.dataset.tier = tier.id;
}

// ─── Planned: tier-promotion animation ──────────────────────────────────────────
//
// When a customer moves up a tier (Silver -> Gold and so on), the change should be a
// MOMENT, not a silent repaint — the whole surface shifting colour is the reward for
// reaching it. Not built; recorded here so the seam is designed rather than retrofitted.
//
// The seam that makes it possible already exists: every accent is a CSS custom property on
// :root, so a promotion is one variable write and a transition can interpolate it. What is
// missing:
//
//  1. A backend field to change. resolveCustomerTier returns a constant today, so nothing
//     can detect a transition — there is no previous value to compare against.
//  2. Previous-tier memory. The animation needs from/to, which means persisting the last
//     seen tier (localStorage, or a `tier_changed_at` from the API) so a promotion fires
//     once rather than on every mount.
//  3. The transition itself. CSS custom properties do not animate by default — they need
//     @property registration with syntax: '<color>' to interpolate rather than snap.
//
// Deliberately not stubbed: an animation with no real trigger would be scaffolding that
// looks finished, and getting the from/to semantics right needs the actual field to exist.
// Revisit when Nkap ships a tier.
export function detectTierPromotion(previousTierId, nextTierId) {
  if (!previousTierId || previousTierId === nextTierId) return null;

  const from = TIER_ORDER.indexOf(previousTierId);
  const to = TIER_ORDER.indexOf(nextTierId);
  if (from === -1 || to === -1) return null;

  // Direction matters: a promotion is celebrated, a downgrade should be quiet.
  return to > from ? { from: previousTierId, to: nextTierId, direction: 'up' } : null;
}
