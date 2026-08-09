import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import OperatorRoute from './components/OperatorRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ApiDashboard from './internal/ApiDashboard';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      {/* ThemeProvider wraps AuthProvider so the theme attribute is set before any route
          renders — otherwise the dashboard paints dark for a frame before flipping. */}
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            {/* terra-api-adr-012 — operator surface, now the APP'S DEFAULT LANDING ROUTE
                (2026-08-09, Will's call — this is his own internal tool first, not a
                customer-facing product yet, so "/" should open on it rather than an empty
                customer dashboard). Previously an "Operator" tab merged in here 2026-08-09; see
                ApiDashboard.js's own comment for that history. OperatorRoute is a ROUTING
                convenience, not a security boundary: enforcement is server-side in
                InternalEcosystemController (role=internal AND ops:read). A non-operator who
                navigates here is redirected to /dashboard rather than shown an empty page —
                see OperatorRoute.js, which redirects there specifically (not "/") to avoid a
                redirect loop against this same route. */}
            <Route
              path="/"
              element={
                <OperatorRoute>
                  <ApiDashboard />
                </OperatorRoute>
              }
            />
            {/* Customer-facing dashboard, moved off "/" to /dashboard (2026-08-09) so it no
                longer collides with the internal page's new default-landing spot above. */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
