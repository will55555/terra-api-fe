import {
  DOMAINS,
  ANCHOR,
  KNOWN_SERVICE_IDS,
  findDomainByServiceId,
  ringPositions,
  entitledServices,
} from './domainConfig';

// TFE-401/402 — the ecosystem taxonomy and ring geometry.
//
// ringPositions has already produced one real bug: an earlier version varied Y by
// sin(angle) while Z used the same sin, so both axes moved together and the "ring" rendered
// as a diagonal LINE. That is what the coplanarity test below pins.

describe('taxonomy', () => {
  it('has exactly eight domains at the corners of a 2x2x2 shell', () => {
    expect(DOMAINS).toHaveLength(8);

    // Every corner is a distinct sign combination of the same magnitude. A duplicate would
    // put two domains inside each other.
    const corners = new Set(DOMAINS.map((d) => d.position.join(',')));
    expect(corners.size).toBe(8);
  });

  it('anchors Terra API at the origin, not at a corner', () => {
    // Terra API is infrastructure every domain consumes — it is what the corners orbit, and
    // it deliberately does not occupy one of the eight.
    expect(ANCHOR.position).toEqual([0, 0, 0]);
  });

  it('maps only the services that actually report health', () => {
    // ROMS and PIOS are the only deployed services. Every other domain is deliberately
    // serviceless: a domain with no built software has no health to report, and inventing a
    // serviceId for it would make the visualizer wait on a heartbeat that never comes.
    expect(KNOWN_SERVICE_IDS.sort()).toEqual(['pios', 'roms']);
  });

  it('places each service under the domain it SERVES, not whoever built it', () => {
    // Terra Tech builds most of this software but is not a domain. The regression this
    // catches is someone "correcting" PIOS into a Terra Tech cube.
    expect(findDomainByServiceId('roms').id).toBe('hospitality');
    expect(findDomainByServiceId('pios').id).toBe('ventures');
  });

  it('returns null for an unknown service id', () => {
    expect(findDomainByServiceId('nonexistent')).toBeNull();
  });
});

describe('ringPositions', () => {
  it('returns nothing for an empty ring', () => {
    expect(ringPositions(0)).toEqual([]);
  });

  it('keeps every cube coplanar on Y', () => {
    // THE regression test. Y varying with the angle collapsed the ring into a diagonal line,
    // because Z used the same sin(angle). The isometric camera already supplies depth.
    for (const count of [1, 2, 3, 5, 8]) {
      const ys = ringPositions(count).map(([, y]) => y);
      expect(ys.every((y) => y === 0)).toBe(true);
    }
  });

  it('spaces cubes evenly at a constant radius', () => {
    const positions = ringPositions(4);
    const radii = positions.map(([x, , z]) => Math.hypot(x, z));

    // All the same distance from the anchor, so no cube reads as "further out" for reasons
    // unrelated to meaning.
    for (const r of radii) {
      expect(r).toBeCloseTo(radii[0], 5);
    }
  });

  it('produces distinct positions so cubes never overlap', () => {
    const positions = ringPositions(3).map((p) => p.map((n) => n.toFixed(4)).join(','));
    expect(new Set(positions).size).toBe(3);
  });
});

describe('entitledServices', () => {
  it('maps health-response service ids onto the local taxonomy', () => {
    const result = entitledServices({
      roms: { running: false },
      pios: { running: true, tier: 'HEALTHY' },
    });

    expect(result).toHaveLength(2);
    expect(result.map((s) => s.serviceId).sort()).toEqual(['pios', 'roms']);
    expect(result.find((s) => s.serviceId === 'roms').domainName).toBe('Hospitality');
  });

  it('skips services the frontend has no config for', () => {
    // A backend reporting a service this build does not know about is a config gap worth
    // noticing, not something to render nameless.
    const result = entitledServices({ roms: { running: true }, unknown_service: { running: true } });

    expect(result).toHaveLength(1);
    expect(result[0].serviceId).toBe('roms');
  });

  it('returns nothing when the customer is entitled to nothing', () => {
    // The correct response for an unseeded customer — entitlement is explicit, with no
    // grant-all fallback (terra-api-adr-011, resolved 2026-08-02).
    expect(entitledServices({})).toEqual([]);
  });
});
