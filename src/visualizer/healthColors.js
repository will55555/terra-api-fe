// Health-tier colour model — TFE-403, terra-api-adr-009's Consequences section.
//
// The logic is TWO-DIMENSIONAL and the order matters: check whether the service is running
// FIRST, then apply a tier colour only if it is. A service that has never sent a heartbeat is
// off, not unhealthy — grey/navy, no tier colour. Collapsing these into one dimension (e.g.
// treating a missing tier as RED) would paint the entire roadmap as broken, since most
// domains have no software built yet.
//
// This mirrors the backend contract exactly: GET /api/v1/ecosystem/health returns
// `running: false` with `tier` OMITTED for anything that has not reported, precisely so the
// frontend never has to infer one from the other.

// Hex ints for Three.js materials. Sourced from the sapphire palette in
// terra-hq-site/terra_api_visualizer_phase5.js so both visualizers read as one system.
export const TIER_COLORS = {
  HEALTHY: 0x00a8d8, // sapphire — the existing "connected" colour, unchanged
  YELLOW: 0xfbbf24,
  ORANGE: 0xfb923c,
  RED: 0xf87171,
};

// Not running: never reported, or reported and then went silent. Deliberately the same
// muted navy the phase5 visualizer uses for unconnected cubes.
export const OFF_COLOR = 0x003d7a;

// A domain shell with no service at all (Real Estate, Agriculture, Apparel, Africa, Solar
// today). Dimmer still than OFF — the distinction is "nothing built here yet" versus
// "something exists but is not running", and conflating them would misrepresent the roadmap.
export const UNBUILT_COLOR = 0x1a2740;

/**
 * Resolve a cube colour from a service's health entry.
 *
 * @param {{running: boolean, tier?: string}|null|undefined} status
 *        One entry from the health endpoint's `services` array, or null when the domain has
 *        no service mapped at all.
 * @returns {number} A Three.js hex colour.
 */
export function colorForStatus(status) {
  // No service mapped to this domain — an empty shell, not a failure.
  if (!status) {
    return UNBUILT_COLOR;
  }

  // Dimension 1: is it running? Checked before tier, per ADR-009.
  if (!status.running) {
    return OFF_COLOR;
  }

  // Dimension 2: tier, only meaningful once running.
  // Falls back to HEALTHY rather than an error colour when tier is absent: a token issued
  // before the claim existed, or a backend that omits it, should not make a live service
  // look broken. Failing "visually healthy" is right here — the endpoint's own
  // customer_status carries the authoritative rollup.
  return TIER_COLORS[status.tier] ?? TIER_COLORS.HEALTHY;
}

/**
 * Whether a cube should pulse. Only running, non-healthy services draw attention —
 * a healthy service is unremarkable and a dead one is not urgent, it is just off.
 */
export function shouldPulse(status) {
  return Boolean(status?.running && status.tier && status.tier !== 'HEALTHY');
}
