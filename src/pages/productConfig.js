// Product launchpad content — Concept AB (design-reference/terra_dashboard_state_a.html).
//
// Data-driven rather than hand-written markup so a product's state changes in one place.
// `domainId` matches domainConfig.js, keeping the launchpad and the topology describing the
// same ecosystem rather than drifting into two lists.
//
// WHAT IS DELIBERATELY OMITTED FROM THE REFERENCE: the mockup carries invented metrics —
// "MANAGED UNITS: 12", "Waitlist Position: #142". Those were plausible-looking filler for a
// design review, and rendering them in a real dashboard would be showing a customer numbers
// that mean nothing. Layout, copy, and status are real design decisions and are ported
// faithfully; fabricated figures are not. Metric slots return once something computes them.

export const PRODUCT_STATUS = {
  ACTIVE: 'ACTIVE',
  IN_DESIGN: 'IN DESIGN',
  PLANNED: 'PLANNED',
};

export const PRODUCTS = [
  {
    id: 'roms',
    domainId: 'hospitality',
    name: 'ROMS',
    desc: 'Restaurant Order Management System',
    status: PRODUCT_STATUS.ACTIVE,
    // The only product with a deployed backend that reports health, so the only one whose
    // card can show live state. Wired to the topology via serviceId in domainConfig.
    serviceId: 'roms',
    action: { label: 'OPEN', enabled: true },
  },
  {
    id: 'pios',
    domainId: 'ventures',
    name: 'PIOS',
    desc: 'Personal Investment & Portfolio Allocation System',
    status: PRODUCT_STATUS.IN_DESIGN,
    serviceId: 'pios',
    note: 'Design phase — ADR-013 event schema versioning is the gating decision',
    action: { label: 'NOT AVAILABLE', enabled: false },
  },
  {
    id: 'nkap',
    domainId: 'finance',
    name: 'NKAP',
    desc: 'Coin & card system — Orange Money and MTN rails',
    status: PRODUCT_STATUS.IN_DESIGN,
    serviceId: null,
    action: { label: 'NOT AVAILABLE', enabled: false },
  },
  {
    id: 'real-estate',
    domainId: 'real-estate',
    name: 'REAL ESTATE',
    desc: 'Direct fractional real estate acquisition',
    status: PRODUCT_STATUS.PLANNED,
    serviceId: null,
    action: { label: 'NOT AVAILABLE', enabled: false },
  },
  {
    id: 'agriculture',
    domainId: 'agriculture',
    name: 'AGRICULTURE',
    desc: 'Bamboo & calabash — Ghana pilot',
    status: PRODUCT_STATUS.PLANNED,
    serviceId: null,
    action: { label: 'NOT AVAILABLE', enabled: false },
  },
  {
    id: 'apparel',
    domainId: 'apparel',
    name: 'APPAREL',
    desc: 'Ndop — multiples-of-5 collection',
    status: PRODUCT_STATUS.PLANNED,
    serviceId: null,
    action: { label: 'NOT AVAILABLE', enabled: false },
  },
];

export function isLocked(product) {
  return product.status !== PRODUCT_STATUS.ACTIVE;
}
