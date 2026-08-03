// Terra ecosystem topology — TFE-401/402, terra-api-adr-009.
//
// Structure mirrors terra-hq-site/terra_api_visualizer_phase5.js: Terra API anchors the
// centre, eight business DOMAINS sit at the corners of a 2x2x2 shell, and each domain may
// contain one SERVICE cube nested inside it.
//
// The domain/service split matters and is easy to get backwards: a service lives under the
// business domain it SERVES, not under whoever built it. Terra Tech writes most of this
// software but is not a domain — PIOS sits under Ventures because Ventures is the investment
// domain it powers, and ROMS sits under Hospitality because that is the operation it runs.
//
// serviceId is the join key to GET /api/v1/ecosystem/health's `service_id`. Only roms and
// pios exist as reporting services today; every other domain is deliberately serviceless and
// renders as an unlit shell. That is honest rather than incomplete — a domain with no built
// software has no health to report.
//
// Positions are the corners of a 2x2x2 cube (all eight sign combinations of ±0.65) with the
// anchor at origin. Deliberately kept hardcoded and capped at eight rather than computed:
// expansion beyond eight was considered and set aside, so the literal coordinates stay
// readable. If a ninth domain ever lands, swap this for a computed layout (Fibonacci sphere)
// rather than hand-adding a corner — the shell has no ninth corner to give.

export const ANCHOR = {
  id: 'terra-api',
  name: 'Terra API',
  desc: 'Shared services gateway',
  position: [0, 0, 0],
  scale: 0.8,
  isAnchor: true,
};

export const DOMAINS = [
  {
    id: 'finance',
    name: 'Finance',
    desc: 'Nkap coin & card system, payment rails',
    position: [-0.65, 0.65, 0.65],
    service: { id: 'nkap', name: 'Nkap', serviceId: null },
  },
  {
    id: 'hospitality',
    name: 'Hospitality',
    desc: 'Restaurant & resort operations',
    position: [0.65, 0.65, 0.65],
    // One of only two domains whose service actually reports health today.
    service: { id: 'roms', name: 'ROMS', serviceId: 'roms' },
  },
  {
    id: 'real-estate',
    name: 'Real Estate',
    desc: 'PropTech — West Region Resort',
    position: [-0.65, -0.65, 0.65],
    service: null,
  },
  {
    id: 'agriculture',
    name: 'Agriculture',
    desc: 'AgTech — bamboo & calabash, Ghana pilot',
    position: [0.65, -0.65, 0.65],
    service: null,
  },
  {
    id: 'apparel',
    name: 'Apparel',
    desc: 'Ndop, multiples-of-5',
    position: [-0.65, 0.65, -0.65],
    service: null,
  },
  {
    id: 'ventures',
    name: 'Ventures',
    desc: 'Capital governance & investment ops',
    position: [0.65, 0.65, -0.65],
    // The other reporting service. Terra Services (consulting) also sits in this domain
    // commercially, but is deliberately NOT a cube: this is a service-HEALTH topology, and
    // consulting has no heartbeat to report. A permanently-grey cube would imply something
    // is wrong when nothing is.
    service: { id: 'pios', name: 'PIOS', serviceId: 'pios' },
  },
  {
    id: 'africa',
    name: 'Africa',
    desc: 'Family land & Africa operations',
    position: [-0.65, -0.65, -0.65],
    service: null,
  },
  {
    id: 'solar',
    name: 'Solar',
    desc: 'Concept — needs development',
    position: [0.65, -0.65, -0.65],
    service: null,
  },
];

// Every serviceId the topology can render, for filtering the health response down to cubes
// that actually exist on screen.
export const KNOWN_SERVICE_IDS = DOMAINS
  .filter((d) => d.service?.serviceId)
  .map((d) => d.service.serviceId);

export function findDomainByServiceId(serviceId) {
  return DOMAINS.find((d) => d.service?.serviceId === serviceId) ?? null;
}

// ─── Layout mode ────────────────────────────────────────────────────────────────
//
// 'ring'    — CUSTOMER VIEW (default). Renders only the services the customer is entitled
//             to, evenly spaced on a circle around the Terra API anchor. A cube is a
//             SERVICE (ROMS, PIOS), not a domain: a customer thinks "I have ROMS", not "I
//             have Hospitality". The domain survives as a label on the cube.
//
// 'lattice' — The full 8-domain 2x2x2 shell with nested service cubes. This is the public
//             topology terra-hq-site shows. Kept as a working fallback rather than deleted:
//             the geometry and taxonomy are real work, and the ring is a new hypothesis
//             about what a customer actually wants to see. Flip LAYOUT_MODE to compare.
//
// The two differ in kind, not just arrangement — lattice answers "what is the Terra
// ecosystem", ring answers "what do I have". Same scene code renders both.
export const LAYOUT_MODE = 'ring';

// Tight enough that the ring reads as one grouped object rather than scattered cubes. At
// 1.9 the services drifted far from the anchor and the relationship stopped being legible.
const RING_RADIUS = 1.45;

/**
 * Evenly space N cubes on a circle around the anchor.
 *
 * Chosen over the hardcoded 2x2x2 corners because the entitled count is variable (1-3 today,
 * unknown later) and those corners only make sense for exactly 8. A ring degrades
 * gracefully: one cube sits opposite the anchor, two balance it, three form a triangle.
 *
 * Tilted slightly off the horizontal plane so the isometric camera reads it as a ring in 3D
 * rather than as a flat line when the count is small.
 */
export function ringPositions(count) {
  if (count === 0) return [];

  // Flat on the XZ plane. An earlier version also varied Y by sin(angle), which — since Z
  // used the same sin — collapsed the ring into a diagonal LINE rather than a circle. The
  // isometric camera already supplies the sense of depth; tilting the ring as well just
  // destroyed its shape.
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    return [
      Math.cos(angle) * RING_RADIUS,
      0,
      Math.sin(angle) * RING_RADIUS,
    ];
  });
}

/**
 * The service cubes to render in ring mode, derived from what the health endpoint returned.
 *
 * Entitlement filtering already happened server-side (terra-api-adr-011 keys on the JWT sub),
 * so this only maps those service_ids onto the local taxonomy for names and descriptions. A
 * service the backend reports but the frontend has no config for is skipped rather than
 * rendered nameless — that mismatch is a config gap worth noticing, not papering over.
 */
export function entitledServices(statusByServiceId) {
  return Object.keys(statusByServiceId)
    .map((serviceId) => {
      const domain = findDomainByServiceId(serviceId);
      if (!domain) return null;
      return {
        serviceId,
        name: domain.service.name,
        domainName: domain.name,
        desc: domain.desc,
      };
    })
    .filter(Boolean);
}
