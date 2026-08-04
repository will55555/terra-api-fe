import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import OperatorRoute from './components/OperatorRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import OperatorDashboard from './internal/OperatorDashboard';
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
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            {/* terra-api-adr-012 — operator surface. OperatorRoute is a ROUTING convenience,
                not a security boundary: enforcement is server-side in
                InternalEcosystemController (role=internal AND ops:read). A non-operator who
                navigates here is redirected to their own dashboard rather than shown an empty
                page. */}
            <Route
              path="/internal"
              element={
                <OperatorRoute>
                  <OperatorDashboard />
                </OperatorRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
