import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isOperator } from '../services/authService';

// terra-api-adr-012 — routing gate for "/" (moved here from /internal, 2026-08-09 — the
// operator surface is now the app's default landing route, see App.js).
//
// ⚠️ THIS IS NOT A SECURITY BOUNDARY, and ADR-012 is emphatic about it: gating a React route
// controls RENDERING, not ACCESS. The bundle ships to every browser, a customer can read this
// file, and nothing stops anyone calling /api/v1/internal/* directly with their own token.
//
// The real gate is server-side — InternalEcosystemController requires role=internal AND the
// ops:read scope via OperatorAccess, and returns 403 otherwise. That check runs regardless of
// what this component does.
//
// So this exists for one reason: a non-operator who navigates to "/" should land somewhere
// sensible instead of on a page that renders empty and reads as broken. Redirecting to
// /dashboard (the customer dashboard) is the honest outcome — that IS their dashboard. NOT "/"
// — since 2026-08-09 that's this same gated route, and redirecting there would loop.
//
// Note the belt-and-braces: ApiDashboard's Operator tab ALSO handles a 403 from the API,
// because a token can claim role=internal without carrying ops:read. This component only reads
// `role`, so a caller with the role and not the scope passes here and is correctly refused by
// the server.
export default function OperatorRoute({ children }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isOperator()) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}