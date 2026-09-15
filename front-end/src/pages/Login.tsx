import { ShieldCheck } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider.js';

export function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('operator@example.com');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  if (user) return <Navigate to="/" replace />;
  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError('');
    try { await login(email, password); } catch (err) { setError(err instanceof Error ? err.message : 'Login failed'); } finally { setPending(false); }
  }
  return <main className="login">
    <form onSubmit={submit} className="loginPanel">
      <ShieldCheck size={36} />
      <h1>Incident Command</h1>
      <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {error && <div className="error">{error}</div>}
      <button disabled={pending}>{pending ? 'Signing in...' : 'Sign in'}</button>
    </form>
  </main>;
}
