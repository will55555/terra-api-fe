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
      const response = await authFetch('/api/v1/ecosystem/health');

      if (!response.ok) {
        throw new Error(`ecosystem health returned ${response.status}`);
      }

      const data = await response.json();
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
