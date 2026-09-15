export type User = { id: string; email: string; role: 'operator' | 'admin' };
export type Incident = {
  id: string;
  source: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  status: 'open' | 'escalated' | 'acknowledged' | 'resolved';
  occurredAt: string;
  receivedAt: string;
  escalationDueAt?: string | null;
  escalatedAt?: string | null;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  assignedTo?: string | null;
  version: number;
  assignee?: User | null;
  history?: Array<{ id: string; action: string; fromStatus?: string; toStatus?: string; actorType: string; createdAt: string; details?: unknown }>;
};

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export function getToken() {
  return sessionStorage.getItem('token');
}

export function setToken(token: string | null) {
  if (token) sessionStorage.setItem('token', token);
  else sessionStorage.removeItem('token');
}

function notifyUnauthorized() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('auth:unauthorized'));
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('content-type', 'application/json');
  const token = getToken();
  if (token) headers.set('authorization', `Bearer ${token}`);
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) {
    setToken(null);
    notifyUnauthorized();
  }
  if (!res.ok) {
    const message = body?.error?.message || 'Request failed';
    throw Object.assign(new Error(message), { status: res.status, body });
  }
  return body;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ data: { token: string; user: User } }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request<{ data: { user: User } }>('/auth/me'),
  incidents: (params: URLSearchParams) => request<{ data: Incident[]; pagination: any }>(`/incidents?${params}`),
  incident: (id: string) => request<{ data: Incident }>(`/incidents/${id}`),
  status: (id: string, status: 'acknowledged' | 'resolved', version: number) =>
    request<{ data: Incident }>(`/incidents/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, version }) }),
  assign: (id: string, assignedTo: string | null, version: number) =>
    request<{ data: Incident }>(`/incidents/${id}/assignment`, { method: 'PATCH', body: JSON.stringify({ assignedTo, version }) }),
  users: () => request<{ data: User[] }>('/incidents/assignable-users'),
  worker: () => request<{ data: any }>('/health/worker'),
};
