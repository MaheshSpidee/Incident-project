import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthProvider.js';

function UserProbe() {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading</div>;
  return <div>{user ? user.email : 'signed out'}</div>;
}

describe('AuthProvider', () => {
  it('clears user state when an API request reports unauthorized', async () => {
    sessionStorage.setItem('token', 'stale-token');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      data: { user: { id: 'user-1', email: 'operator@example.com', role: 'operator' } },
    }), { status: 200, headers: { 'content-type': 'application/json' } })));

    render(<AuthProvider><UserProbe /></AuthProvider>);
    expect(await screen.findByText('operator@example.com')).toBeInTheDocument();

    window.dispatchEvent(new Event('auth:unauthorized'));

    await waitFor(() => expect(screen.getByText('signed out')).toBeInTheDocument());
    vi.unstubAllGlobals();
  });
});
