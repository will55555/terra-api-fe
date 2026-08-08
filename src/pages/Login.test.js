import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from './Login';
import { useAuth } from '../context/AuthContext';
import { MemoryRouter } from 'react-router-dom';

jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

describe('Login', () => {
  it('renders the login form and submits credentials', async () => {
    const login = jest.fn().mockResolvedValue(undefined);
    useAuth.mockReturnValue({ login });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Login />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByLabelText(/username/i), 'demo');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));

    expect(login).toHaveBeenCalledWith('demo', 'secret');
  });
});
