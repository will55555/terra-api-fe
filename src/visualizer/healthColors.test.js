import { colorForStatus, shouldPulse, TIER_COLORS, OFF_COLOR, UNBUILT_COLOR } from './healthColors';

// TFE-403 — the health-tier colour model from terra-api-adr-009.
//
// The rule this file exists to protect: the logic is TWO-DIMENSIONAL and ordered. Running is
// checked first, tier only if running. Collapsing those into one dimension — treating a
// missing tier as unhealthy — would paint the entire roadmap as broken, since most Terra
// domains have no software built yet. That is the regression these tests catch.

describe('colorForStatus', () => {
  it('returns the unbuilt colour when a domain has no service at all', () => {
    // Distinct from "off": nothing was ever built here, versus something exists but is not
    // running. Conflating them would misrepresent the roadmap.
    expect(colorForStatus(null)).toBe(UNBUILT_COLOR);
    expect(colorForStatus(undefined)).toBe(UNBUILT_COLOR);
  });

  it('returns the off colour for a service that is not running, whatever its tier', () => {
    expect(colorForStatus({ running: false })).toBe(OFF_COLOR);
    // Even if a tier somehow arrives alongside running: false, off wins — dimension one is
    // checked first by design.
    expect(colorForStatus({ running: false, tier: 'RED' })).toBe(OFF_COLOR);
  });

  it('maps each running tier to its colour', () => {
    expect(colorForStatus({ running: true, tier: 'HEALTHY' })).toBe(TIER_COLORS.HEALTHY);
    expect(colorForStatus({ running: true, tier: 'YELLOW' })).toBe(TIER_COLORS.YELLOW);
    expect(colorForStatus({ running: true, tier: 'ORANGE' })).toBe(TIER_COLORS.ORANGE);
    expect(colorForStatus({ running: true, tier: 'RED' })).toBe(TIER_COLORS.RED);
  });

  it('falls back to healthy for a running service with no tier', () => {
    // A token issued before the claim existed, or a backend that omits it, must not make a
    // live service look broken. Failing "visually healthy" is right here — customer_status
    // carries the authoritative rollup.
    expect(colorForStatus({ running: true })).toBe(TIER_COLORS.HEALTHY);
    expect(colorForStatus({ running: true, tier: 'NONSENSE' })).toBe(TIER_COLORS.HEALTHY);
  });
});

describe('shouldPulse', () => {
  it('pulses only running, non-healthy services', () => {
    expect(shouldPulse({ running: true, tier: 'YELLOW' })).toBe(true);
    expect(shouldPulse({ running: true, tier: 'ORANGE' })).toBe(true);
    expect(shouldPulse({ running: true, tier: 'RED' })).toBe(true);
  });

  it('does not pulse healthy, off, or absent services', () => {
    // Drawing the eye to everything draws it to nothing. A healthy service is unremarkable
    // and an off one is not urgent — it is just off.
    expect(shouldPulse({ running: true, tier: 'HEALTHY' })).toBe(false);
    expect(shouldPulse({ running: false, tier: 'RED' })).toBe(false);
    expect(shouldPulse(null)).toBe(false);
    expect(shouldPulse(undefined)).toBe(false);
  });
});
