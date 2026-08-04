import React from 'react';

// terra-api-adr-012 — the detail the cubes cannot carry.
//
// The lattice above answers "is anything wrong"; this answers "what, why, since when, and who
// is affected". Both are needed: a 3D scene cannot show a reason string or a customer roster,
// and a table alone loses the at-a-glance read.
//
// Server-sorted worst-first, preserved as received.

// Formats an age in seconds as a compact duration. A raw "412" forces the reader to do
// arithmetic during an incident, which is exactly when they should not have to.
function formatAge(seconds) {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

// Operator vocabulary — unsoftened, unlike the customer view's "SOME SERVICES DEGRADED".
// ORANGE says QUARANTINED because that is the actual enforcement state (ADR-005 §3), and
// distinguishing suspension from full containment is the operator's whole reason for looking.
const TIER_LABEL = {
  HEALTHY: 'HEALTHY',
  YELLOW: 'DEGRADED',
  ORANGE: 'QUARANTINED',
  RED: 'CONTAINED',
};

export default function OperatorServiceTable({ services = [] }) {
  if (services.length === 0) {
    return (
      <p className="cm-placeholder-note">
        No services reporting — nothing has sent a heartbeat yet
      </p>
    );
  }

  return (
    <div className="op-table-wrap">
      <table className="op-table">
        <thead>
          <tr>
            <th>Service</th>
            <th>State</th>
            <th>Reason</th>
            <th>Since</th>
            <th>Last beat</th>
            <th>Affected</th>
          </tr>
        </thead>
        <tbody>
          {services.map((s) => (
            <tr key={s.service_id} className={`op-row op-tier-${(s.tier ?? 'unknown').toLowerCase()}`}>
              <td className="op-service-id">{s.service_id}</td>
              <td>
                <span className={`op-tier-badge op-tier-${(s.tier ?? 'unknown').toLowerCase()}`}>
                  {TIER_LABEL[s.tier] ?? s.tier ?? '—'}
                </span>
              </td>
              {/* Omitted entirely when healthy — the backend sends no reason, and an em dash
                  is more honest than inventing "none". */}
              <td className="op-reason">{s.reason ?? '—'}</td>
              <td>{s.since ? new Date(s.since).toLocaleTimeString() : '—'}</td>
              <td>{formatAge(s.seconds_since_heartbeat)}</td>
              {/* The cross-customer roster — the single most sensitive field on the page, and
                  the reason this endpoint requires ops:read on top of role=internal. */}
              <td className="op-affected">
                {s.affected_customers?.length
                  ? s.affected_customers.join(', ')
                  : <span className="op-none">none</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}