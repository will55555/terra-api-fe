import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isOperator } from '../services/authService';

// terra-api-adr-012 — routing gate for /internal.
//
// ⚠️ THIS IS NOT A SECURITY BOUNDARY, and ADR-012 is emphatic about it: gating a React route
// controls RENDERING, not ACCESS. The bundle ships to every browser, a customer can read this
// file, and nothing stops anyone calling /api/v1/internal/* directly with their own token.
//
// The real gate is server-side — InternalEcosystemController requires role=internal AND the
// ops:read scope via OperatorAccess, and returns 403 otherwise. That check runs regardless of
// what this component does.
//
// So this exists for one reason: a non-operator who navigates to /internal should land
// somewhere sensible instead of on a page that renders empty and reads as broken. Redirecting
// to the customer dashboard is the honest outcome — that IS their dashboard.
//
// Note the belt-and-braces: OperatorDashboard ALSO handles a 403 from the API, because a token
// can claim role=internal without carrying ops:read. This component only reads `role`, so a
// caller with the role and not the scope passes here and is correctly refused by the server.
export default function OperatorRoute({ children }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isOperator()) {
    return <Navigate to="/" replace />;
  }

  return children;
}