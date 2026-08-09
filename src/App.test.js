import { render, screen } from '@testing-library/react';
import App from './App';

test('redirects unauthenticated users to the login page', () => {
  localStorage.clear();
  render(<App />);
  // "terra login" never matched Login.js's actual markup — the brand ("Terra") and the heading
  // ("Sign In") are separate elements, never one combined string. Login.js also has a
  // subtitle ("Sign in to continue...") that also matches /sign in/i, so getByText on that
  // pattern alone is ambiguous — the <h1> role narrows it to the actual heading.
  expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
});
