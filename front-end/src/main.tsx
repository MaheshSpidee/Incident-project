import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell.js';
import { AuthProvider, useAuth } from './components/AuthProvider.js';
import { Dashboard } from './pages/Dashboard.js';
import { Login } from './pages/Login.js';
import './styles.css';

const queryClient = new QueryClient();

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <main className="center">Loading...</main>;
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell><Dashboard /></AppShell>;
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Protected />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
