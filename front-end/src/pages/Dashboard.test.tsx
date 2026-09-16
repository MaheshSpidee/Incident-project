import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, type Incident } from '../api/client.js';
import { Dashboard } from './Dashboard.js';

vi.mock('../components/AuthProvider.js', () => ({
  useAuth: () => ({ user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } }),
}));

const incident: Incident = {
  id: '11111111-1111-4111-8111-111111111111',
  source: 'device-1',
  type: 'cpu',
  severity: 'high',
  message: 'CPU critical',
  status: 'open',
  occurredAt: '2026-01-01T00:00:00.000Z',
  receivedAt: '2026-01-01T00:00:01.000Z',
  version: 1,
  assignee: null,
  history: [{ id: 'history-1', action: 'created', actorType: 'device', createdAt: '2026-01-01T00:00:01.000Z' }],
};

function renderDashboard() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Dashboard />
    </QueryClientProvider>,
  );
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.spyOn(api, 'incidents').mockResolvedValue({ data: [incident], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } });
    vi.spyOn(api, 'incident').mockResolvedValue({ data: incident });
    vi.spyOn(api, 'users').mockResolvedValue({ data: [] });
  });

  it('refreshes selected incident details when the user refreshes the list', async () => {
    renderDashboard();
    await screen.findByText('device-1');
    await userEvent.click(screen.getByText('device-1'));
    await waitFor(() => expect(api.incident).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole('button', { name: /refresh/i }));

    await waitFor(() => expect(api.incidents).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(api.incident).toHaveBeenCalledTimes(2));
  });
});
