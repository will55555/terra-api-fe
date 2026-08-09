import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './login.css';

// Social sign-in is NOT wired to real OAuth yet — these are Terra-branded placeholder buttons
// (disabled, "coming soon"), not real provider logos. Do not swap in Google/Apple's actual
// branding here; when the integration exists, replace icon + enable the button together.
const SOCIAL_PROVIDERS = [
  { id: 'google', label: 'Google' },
  { id: 'apple', label: 'Apple' },
];

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
      const params = new URLSearchParams(location.search);
      const redirectTarget = params.get('redirect');
      navigate(redirectTarget || '/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-brand-title">Terra</span>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <h1>Sign In</h1>
          <p className="login-subtitle">Sign in to continue to your dashboard.</p>
          <label className="login-field" htmlFor="username">
            <span>Username</span>
            <input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label className="login-field" htmlFor="password">
            <span>Password</span>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="login-button" type="submit">Log In</button>
        </form>

        <div className="login-divider">
          <span>or</span>
        </div>

        <div className="login-social">
          {SOCIAL_PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              type="button"
              className="login-social-button"
              disabled
              title="Coming soon"
            >
              <span className={`login-social-icon login-social-icon-${provider.id}`} aria-hidden="true" />
              Continue with {provider.label}
            </button>
          ))}
          <p className="login-social-note">Social sign-in coming soon</p>
        </div>
      </div>
    </div>
  );
}
