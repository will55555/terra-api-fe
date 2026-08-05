// Terra ecosystem topology — TFE-401/402, terra-api-adr-009.
//
// PORTED VERBATIM from terra-hq-site/terra_api_visualizer_phase5.js's CUBE_CONFIG (repo
// ROOT, not archive/). Names, descriptions, positions, scales, and colours are that file's
// values, not re-derived ones. An earlier version of this file invented its own taxonomy and
// immediately drifted — hq-site named Nkap/ROMS/PIOS as real children while this had six
// domains marked service: null. Two sources of truth for one ecosystem is exactly the
// problem ADR-009 avoids by calling phase5 "the shared Three.js reference implementation".
//
// If phase5's CUBE_CONFIG changes, this file follows. It is a mirror, not an opinion.
//
// The one thing added here that phase5 has no concept of: `serviceId`, the join key to
// GET /api/v1/ecosystem/health. hq-site renders a static public topology and never asks who
// is entitled to what; this build filters by entitlement, so it needs to know which cube
// maps to which reporting service. Only ROMS and PIOS have one — every other child is a
// placeholder for software that does not exist yet, and inventing an id for those would make
// the visualizer wait on a heartbeat that never arrives.

export const ANCHOR = {
  id: 'terra-api',
  name: 'Terra API',
  desc: 'Foundation Layer',
  position: [0, 0, 0],
  scale: 0.8,
  isAnchor: true,
};

// Corners of a 2x2x2 shell — all eight sign combinations of ±0.65, exactly as phase5 defines
// them. Terra API sits at the origin, so the eight corners are free for domains.
export const DOMAINS = [
  {
    id: 'finance',
    name: 'Finance',
    desc: 'Financial services',
    position: [-0.65, 0.65, 0.65],
    service: { id: 'nkap', name: 'Nkap', serviceId: null, desc: 'Coin & card system — Orange Money, MTN rails' },
  },
  {
    id: 'hospitality',
    name: 'Hospitality',
    desc: 'Hospitality operations',
    position: [0.65, 0.65, 0.65],
    // One of only two children that maps to a service reporting real health.
    service: { id: 'roms', name: 'ROMS', serviceId: 'roms', desc: 'Restaurant Order Management System' },
  },
  {
    id: 'real-estate',
    name: 'Real Estate',
    desc: 'Property management',
    position: [-0.65, -0.65, 0.65],
    service: { id: 'real-estate-child', name: 'Real Estate (Planned)', serviceId: null, desc: 'Planned — no service yet' },
  },
  {
    id: 'agriculture',
    name: 'Agriculture',
    desc: 'Farm operations',
    position: [0.65, -0.65, 0.65],
    service: { id: 'agriculture-child', name: 'Agriculture (Planned)', serviceId: null, desc: 'Planned — no service yet' },
  },
  {
    id: 'apparel',
    name: 'Apparel',
    desc: 'Design & commerce',
    position: [-0.65, 0.65, -0.65],
    service: { id: 'apparel-child', name: 'Apparel (Planned)', serviceId: null, desc: 'Planned — no service yet' },
  },
  {
    id: 'ventures',
    name: 'Ventures',
    desc: 'Investment structuring',
    position: [0.65, 0.65, -0.65],
    // The other reporting service. Terra Services (consulting) also sits in this domain
    // commercially but is deliberately not a cube: this is a service-HEALTH topology and
    // consulting has no heartbeat, so it would be permanently grey for reasons unrelated to
    // anything being wrong.
    service: { id: 'pios', name: 'PIOS', serviceId: 'pios', desc: 'Portfolio & Investment Ops System' },
  },
  {
    id: 'africa',
    name: 'Africa',
    desc: 'Regional systems',
    position: [-0.65, -0.65, -0.65],
    service: { id: 'africa-child', name: 'Africa (Planned)', serviceId: null, desc: 'Planned — no service yet' },
  },
  {
    id: 'solar',
    name: 'Solar',
    desc: 'Concept — needs development',
    position: [0.65, -0.65, -0.65],
    service: { id: 'solar-child', name: 'Solar (Planned)', serviceId: null, desc: 'Concept — needs development' },
  },
];

// phase5's palette. The service cubes are a lighter sapphire than their domain shells, which
// is what makes a nested child legible inside its translucent parent.
export const DOMAIN_COLOR = 0x003d7a;
export const SERVICE_COLOR = 0x00a8d8;

// Every serviceId the topology can actually render health for.
export const KNOWN_SERVICE_IDS = DOMAINS
  .filter((d) => d.service?.serviceId)
  .map((d) => d.service.serviceId);

export function findDomainByServiceId(serviceId) {
  return DOMAINS.find((d) => d.service?.serviceId === serviceId) ?? null;
}

// ─── Layout mode ────────────────────────────────────────────────────────────────
//
// 'lattice' — phase5's full 8-domain 2x2x2 shell with nested service cubes. The complete
//             ecosystem, matching what terra-hq-site shows publicly.
//
// 'ring'    — Entitled services only, evenly spaced around the anchor. Built for the
//             customer view on the reading that a customer wants "what I have" rather than
//             "what Terra is". Kept available, but no longer the default: with 1-2 entitled
//             services the ring is two cubes and a centre, which reads as sparse rather than
//             focused, and it loses the domain context that makes the ecosystem legible.
//
// Lattice is the default. Entitlement still matters — it drives which service cubes light
// up (health colour) versus render as unlit shells — but every domain stays visible, so a
// customer sees the whole ecosystem with their own products lit within it.
export const LAYOUT_MODE = 'lattice';

const RING_RADIUS = 1.45;

/**
 * Evenly space N cubes on a circle around the anchor. Ring mode only.
 *
 * Flat on the XZ plane. An earlier version also varied Y by sin(angle), which — since Z used
 * the same sin — collapsed the ring into a diagonal LINE rather than a circle.
 */
export function ringPositions(count) {
  if (count === 0) return [];

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
 * Service cubes to render in ring mode, derived from the health response.
 *
 * Entitlement filtering already happened server-side (terra-api-adr-011 keys on the JWT sub),
 * so this only maps those service_ids onto the local taxonomy. A service the backend reports
 * but this build has no config for is skipped rather than rendered nameless — that mismatch
 * is a config gap worth noticing, not papering over.
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
