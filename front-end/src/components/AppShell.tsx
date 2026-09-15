import { LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from './AuthProvider.js';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  return <div>
    <header className="topbar">
      <div className="brand"><ShieldAlert size={24} /> Incident Command</div>
      <div className="userbar"><span>{user?.email} · {user?.role}</span><button onClick={logout}><LogOut size={16} /> Logout</button></div>
    </header>
    {children}
  </div>;
}
