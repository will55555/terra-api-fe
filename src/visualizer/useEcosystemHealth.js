import { useCallback, useEffect, useRef, useState } from 'react';
import { authFetch } from '../services/authService';

// TFE-402 — consumes GET /api/v1/ecosystem/health (terra-api-adr-005's 2026-08-02 amendment).
//
// The response is ALREADY scoped to the authenticated customer: the backend filters by
// customer_service_access keyed on the JWT sub (terra-api-adr-011), so this hook does no
// entitlement logic of its own. It receives only what the customer is entitled to see, which
// is the whole point of the endpoint existing separately from the operator-facing
// /actuator/ecosystem-health.
//
// Contract, verified live 2026-08-02:
//   {"services":[{"service_id":"roms","running":false}],"customer_status":"healthy"}
// `tier` is OMITTED (not null) when running is false — see healthColors.js.
//
// Polling rather than websockets: quarantine tiers move on heartbeat intervals measured in
// tens of seconds, so sub-second push buys nothing and costs a connection to keep alive.

const POLL_INTERVAL_MS = 30000;

// DEV-ONLY TEST TOOLING, added 2026-08-04 — kept intentionally, not scaffolding to delete
// later. Nothing is deployed yet (no real ROMS/PIOS, nothing else has code at all), so this is
// the only way to visually verify tier colours/pulse/layout before a real service ever reports
// a heartbeat, and it stays useful for the same purpose after that (e.g. testing a tier this
// build has never actually seen in production). Opt-in only via a URL query param — real fetch/
// poll runs unmodified whenever neither flag is present, which is every normal page load:
//   ?mockHealth=1    — two services (ROMS/PIOS), matching what production actually maps today
//   ?mockHealthAll=1 — all 8 domains lit with varying status, for inspecting every cube/child
//                      pair in one pass (pairs with terraScene.js's matching
//                      SERVICE_ID_BY_CUBE_NAME override — production only maps ROMS/PIOS by
//                      design, so testing the other 6 needs that override too)
function getMockHealthOverride() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);

  if (params.get('mockHealthAll') === '1') {
    // One of each: first domain OFF (never reported), remaining 7 cycled across the 4 real
    // tiers so every domain/child pair shows a distinct, plausible status in one pass.
    const tierCycle = ['HEALTHY', 'YELLOW', 'ORANGE', 'RED'];
    const allServiceIds = ['nkap', 'roms', 'real-estate-child', 'agriculture-child',
      'apparel-child', 'pios', 'africa-child', 'solar-child'];
    const [offId, ...onIds] = allServiceIds;
    return {
      services: [
        { service_id: offId, running: false },
        ...onIds.map((id, i) => ({
          service_id: id,
          running: true,
          tier: tierCycle[i % tierCycle.length],
        })),
      ],
      customer_status: 'degraded',
    };
  }

  if (params.get('mockHealth') !== '1') return null;
  return {
    services: [
      { service_id: 'roms', running: true, tier: 'HEALTHY' },
      { service_id: 'pios', running: true, tier: 'YELLOW' },
    ],
    customer_status: 'degraded',
  };
}

export default function useEcosystemHealth({ pollIntervalMs = POLL_INTERVAL_MS } = {}) {
  const [statusByServiceId, setStatusByServiceId] = useState({});
  const [customerStatus, setCustomerStatus] = useState(null);
  const [error, setError] = useState(null);
  // Distinguishes "first load, nothing to show yet" from "refreshing, keep showing what we
  // have". Without it every poll would flash the whole topology back to a loading state.
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Guards against setState after unmount, and against a slow in-flight response landing
  // after a newer one — StrictMode double-invokes effects in dev, so this is not theoretical.
  const isMountedRef = useRef(true);

  const fetchHealth = useCallback(async () => {
    try {
      // See getMockHealthOverride's comment above — dev-only, opt-in, temporary.
      const mock = getMockHealthOverride();
      const data = mock ?? await (async () => {
        const response = await authFetch('/api/v1/ecosystem/health');
        if (!response.ok) {
          throw new Error(`ecosystem health returned ${response.status}`);
        }
        return response.json();
      })();

      if (!isMountedRef.current) return;

      // Keyed by service_id so the renderer can look up a cube's status directly rather than
      // scanning the array once per cube.
      const next = {};
      for (const service of data.services ?? []) {
        next[service.service_id] = service;
      }

      setStatusByServiceId(next);
      setCustomerStatus(data.customer_status ?? null);
      setError(null);
    } catch (e) {
      if (!isMountedRef.current) return;
      // Deliberately does NOT clear existing status: a transient network blip should leave
      // the last known topology on screen rather than blanking it to grey, which would read
      // as "everything went down" when only the poll failed.
      setError(e.message);
    } finally {
      if (isMountedRef.current) {
        setIsInitialLoad(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchHealth();

    const timer = setInterval(fetchHealth, pollIntervalMs);
    return () => {
      isMountedRef.current = false;
      clearInterval(timer);
    };
  }, [fetchHealth, pollIntervalMs]);

  return { statusByServiceId, customerStatus, error, isInitialLoad, refresh: fetchHealth };
}
