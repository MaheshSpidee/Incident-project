import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useMemo, useState } from 'react';
import { api, type Incident } from '../api/client.js';
import { useAuth } from '../components/AuthProvider.js';

function badge(value: string) { return <span className={`badge ${value}`}>{value}</span>; }

export function Dashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const params = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), limit: '10' });
    if (status) p.set('status', status);
    if (severity) p.set('severity', severity);
    if (source) p.set('source', source);
    return p;
  }, [status, severity, source, page]);
  const list = useQuery({ queryKey: ['incidents', params.toString()], queryFn: () => api.incidents(params), refetchInterval: 5000 });
  const detail = useQuery({ queryKey: ['incident', selected], queryFn: () => api.incident(selected!), enabled: Boolean(selected) });
  const users = useQuery({ queryKey: ['users'], queryFn: api.users, enabled: user?.role === 'admin' });
  const mutateStatus = useMutation({
    mutationFn: ({ id, next, version }: { id: string; next: 'acknowledged' | 'resolved'; version: number }) => api.status(id, next, version),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['incidents'] }); qc.invalidateQueries({ queryKey: ['incident'] }); },
    onError: (error: any) => {
      if (error?.status === 409) {
        qc.invalidateQueries({ queryKey: ['incidents'] });
        qc.invalidateQueries({ queryKey: ['incident'] });
      }
    },
  });
  const assign = useMutation({
    mutationFn: ({ id, assignedTo, version }: { id: string; assignedTo: string | null; version: number }) => api.assign(id, assignedTo, version),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['incidents'] }); qc.invalidateQueries({ queryKey: ['incident'] }); },
    onError: (error: any) => {
      if (error?.status === 409) {
        qc.invalidateQueries({ queryKey: ['incidents'] });
        qc.invalidateQueries({ queryKey: ['incident'] });
      }
    },
  });
  const items = list.data?.data ?? [];
  const active = detail.data?.data;
  return <main className="dashboard">
    <section className="filters">
      <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}><option value="">All status</option><option>open</option><option>escalated</option><option>acknowledged</option><option>resolved</option></select>
      <select value={severity} onChange={(e) => { setPage(1); setSeverity(e.target.value); }}><option value="">All severity</option><option>low</option><option>medium</option><option>high</option></select>
      <input placeholder="Search source" value={source} onChange={(e) => { setPage(1); setSource(e.target.value); }} />
      <button onClick={() => list.refetch()}><RefreshCw size={16} /> Refresh</button>
      <span className="refresh">{list.dataUpdatedAt ? `Updated ${new Date(list.dataUpdatedAt).toLocaleTimeString()}` : 'Not refreshed yet'}</span>
      {list.isError && <span className="error">Refresh failed</span>}
    </section>
    <section className="grid">
      <div className="tableWrap">
        {list.isLoading ? <div className="state">Loading incidents...</div> : items.length === 0 ? <div className="state">No incidents match these filters.</div> : <table>
          <thead><tr><th>Incident</th><th>Severity</th><th>Status</th><th>Age</th><th>Assignment</th></tr></thead>
          <tbody>{items.map((i) => <tr key={i.id} onClick={() => setSelected(i.id)} className={selected === i.id ? 'selected' : ''}>
            <td><strong>{i.source}</strong><span>{i.type}</span><p>{i.message}</p></td>
            <td>{badge(i.severity)}</td><td>{i.status === 'escalated' && <AlertTriangle size={15} />} {badge(i.status)}</td>
            <td>{formatDistanceToNow(new Date(i.receivedAt), { addSuffix: true })}</td>
            <td>{i.assignee?.email ?? 'Unassigned'}</td>
          </tr>)}</tbody>
        </table>}
        <div className="pager"><button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button><span>Page {page} of {list.data?.pagination.totalPages || 1}</span><button disabled={page >= (list.data?.pagination.totalPages || 1)} onClick={() => setPage((p) => p + 1)}>Next</button></div>
      </div>
      <aside className="detail">{selected && detail.isLoading ? <div className="state">Loading incident details...</div> : selected && detail.isError ? <div className="state"><p>Could not load incident details.</p><button onClick={() => detail.refetch()}>Retry</button></div> : active ? <IncidentDetail incident={active} isAdmin={user?.role === 'admin'} users={users.data?.data ?? []} onStatus={(next) => mutateStatus.mutate({ id: active.id, next, version: active.version })} onAssign={(assignedTo) => assign.mutate({ id: active.id, assignedTo, version: active.version })} pending={mutateStatus.isPending || assign.isPending} error={(mutateStatus.error || assign.error) as Error | null} /> : <div className="state">Select an incident to inspect history and actions.</div>}</aside>
    </section>
  </main>;
}

function IncidentDetail({ incident, isAdmin, users, onStatus, onAssign, pending, error }: { incident: Incident; isAdmin: boolean; users: any[]; onStatus: (s: 'acknowledged' | 'resolved') => void; onAssign: (id: string | null) => void; pending: boolean; error: Error | null }) {
  const canAck = incident.status === 'open' || incident.status === 'escalated';
  const canResolve = incident.status === 'acknowledged';
  return <div>
    <h2>{incident.source}</h2>
    <p className="message">{incident.message}</p>
    <div className="meta">{badge(incident.severity)} {badge(incident.status)} {incident.escalatedAt && <span className="escalated"><AlertTriangle size={15} /> Escalated {new Date(incident.escalatedAt).toLocaleString()}</span>}</div>
    <dl><dt>Type</dt><dd>{incident.type}</dd><dt>Occurred</dt><dd>{new Date(incident.occurredAt).toLocaleString()}</dd><dt>Received</dt><dd>{new Date(incident.receivedAt).toLocaleString()}</dd><dt>Assignee</dt><dd>{incident.assignee?.email ?? 'Unassigned'}</dd></dl>
    <div className="actions">
      {canAck && <button disabled={pending} onClick={() => onStatus('acknowledged')}><CheckCircle2 size={16} /> Acknowledge</button>}
      {canResolve && <button disabled={pending} onClick={() => onStatus('resolved')}>Resolve</button>}
      {isAdmin && <select value={incident.assignedTo ?? ''} disabled={pending} onChange={(e) => onAssign(e.target.value || null)}><option value="">Unassigned</option>{users.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}</select>}
    </div>
    {error && <div className="error">{error.message}. Refreshing may be required if another actor changed this incident.</div>}
    <h3>History</h3>
    <ol className="history">{incident.history?.map((h) => <li key={h.id}><strong>{h.action}</strong><span>{h.fromStatus ?? ''} {h.toStatus ? `→ ${h.toStatus}` : ''}</span><time>{new Date(h.createdAt).toLocaleString()}</time></li>)}</ol>
  </div>;
}
