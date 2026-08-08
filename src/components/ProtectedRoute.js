import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    const requestedPath = `${location.pathname}${location.search}`;
    const redirectTarget = `/login?redirect=${encodeURIComponent(requestedPath)}`;
    return <Navigate to={redirectTarget} replace />;
  }

  return children;
}
