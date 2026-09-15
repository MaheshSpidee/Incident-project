import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, setToken, type User } from '../api/client.js';

const AuthContext = createContext<{ user: User | null; loading: boolean; login: (e: string, p: string) => Promise<void>; logout: () => void } | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(sessionStorage.getItem('token')));

  useEffect(() => {
    if (!sessionStorage.getItem('token')) return;
    api.me().then((r) => setUser(r.data.user)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      setLoading(false);
    };
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    async login(email: string, password: string) {
      const res = await api.login(email, password);
      setToken(res.data.token);
      setUser(res.data.user);
    },
    logout() {
      setToken(null);
      setUser(null);
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('AuthProvider missing');
  return ctx;
}
