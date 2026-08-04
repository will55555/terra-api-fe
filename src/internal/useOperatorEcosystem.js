import { useCallback, useEffect, useRef, useState } from 'react';
import { authFetch } from '../services/authService';

// terra-api-adr-012 — polls GET /api/v1/internal/ecosystem.
//
// Deliberately separate from useEcosystemHealth rather than parameterised: the two endpoints
// return different shapes for different audiences, and merging them would mean one hook whose
// return type depends on who is logged in. The customer hook keys its result by service_id for
// cube lookup; this one keeps the server's severity-sorted array, because worst-first ordering
// is the operator's primary reading order and re-sorting client-side would discard it.
//
// Polls faster than the customer view (10s vs 30s). An operator watching an incident wants to
// see recovery promptly; a customer glancing at a dashboard does not.
const POLL_INTERVAL_MS = 10000;

export default function useOperatorEcosystem({ pollIntervalMs = POLL_INTERVAL_MS } = {}) {
  const [services, setServices] = useState([]);
  const [ecosystemStatus, setEcosystemStatus] = useState(null);
  const [servicesReporting, setServicesReporting] = useState(0);
  const [error, setError] = useState(null);
  const [forbidden, setForbidden] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const isMountedRef = useRef(true);

  const fetchOperatorHealth = useCallback(async () => {
    try {
      const response = await authFetch('/api/v1/internal/ecosystem');

      // 403 is distinct from a network failure and must not be retried into: the caller
      // authenticated fine but is not an operator. Surfacing it separately lets the page say
      // "you are not an operator" rather than "the feed is down", which is the difference
      // between an accurate message and a misleading one.
      if (response.status === 403) {
        if (isMountedRef.current) {
          setForbidden(true);
          setError(null);
        }
        return;
      }

      if (!response.ok) {
        throw new Error(`operator ecosystem returned ${response.status}`);
      }

      const data = await response.json();
      if (!isMountedRef.current) return;

      // Server-sorted worst-first. Preserved as-is.
      setServices(data.services ?? []);
      setEcosystemStatus(data.ecosystem_status ?? null);
      setServicesReporting(data.services_reporting ?? 0);
      setForbidden(false);
      setError(null);
    } catch (e) {
      if (!isMountedRef.current) return;
      // Deliberately does NOT clear `services`: a transient blip should leave the last known
      // state on screen rather than blanking the table, which during an incident would read as
      // "everything recovered" when nothing changed.
      setError(e.message);
    } finally {
      if (isMountedRef.current) setIsInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchOperatorHealth();

    const timer = setInterval(fetchOperatorHealth, pollIntervalMs);
    return () => {
      isMountedRef.current = false;
      clearInterval(timer);
    };
  }, [fetchOperatorHealth, pollIntervalMs]);

  // The visualizer expects a service_id-keyed map; the table wants the sorted array. Derived
  // here so both consumers read one fetch rather than polling separately and disagreeing.
  const statusByServiceId = services.reduce((acc, s) => {
    acc[s.service_id] = s;
    return acc;
  }, {});

  return {
    services,
    statusByServiceId,
    ecosystemStatus,
    servicesReporting,
    error,
    forbidden,
    isInitialLoad,
    refresh: fetchOperatorHealth,
  };
}