import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '../components/AuthProvider.js';
import { Login } from './Login.js';

describe('Login', () => {
  it('renders login form', () => {
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><AuthProvider><Login /></AuthProvider></MemoryRouter></QueryClientProvider>);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('operator@example.com')).toBeInTheDocument();
  });
});
