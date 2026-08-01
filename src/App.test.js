import { render, screen } from '@testing-library/react';
import App from './App';

test('redirects unauthenticated users to the login page', () => {
  localStorage.clear();
  render(<App />);
  expect(screen.getByText(/terra login/i)).toBeInTheDocument();
});
