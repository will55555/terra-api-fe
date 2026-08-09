import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { useAuth } from '../context/AuthContext';

jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

function LoginRoute() {
  const location = useLocation();
  return <div data-testid="login-page">{location.search}</div>;
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ isAuthenticated: false });
  });

  it('redirects unauthenticated users to login with the requested path preserved', () => {
    render(
      <MemoryRouter initialEntries={['/protected']}> 
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route
            path="*"
            element={
              <ProtectedRoute>
                <div>Protected content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    const loginPage = screen.getByTestId('login-page');
    expect(loginPage).toHaveTextContent('redirect=%2Fprotected');
  });
});
