import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { useEffect } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AnalysisDetail from './pages/AnalysisDetail';
import { processQueue } from './lib/sync';
import { Toaster } from 'react-hot-toast';
import { DebugLogger } from './components/DebugLogger';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAuth } from './hooks/useAuth';
import { addDebugLog } from './lib/debug';

export default function App() {
  const { session, loading } = useAuth();

  useEffect(() => {
    addDebugLog('info', 'Iniciando app');
    document.title = 'CheckFlow';

    processQueue();

    const handleOnline = () => {
      addDebugLog('info', 'App voltou a ficar online. Processando fila');
      processQueue();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">Carregando...</div>;
  }

  const router = createBrowserRouter([
    { path: '/', element: session ? <Navigate to="/dashboard" replace /> : <Login /> },
    { path: '/register', element: session ? <Navigate to="/dashboard" replace /> : <Register /> },
    { path: '/dashboard', element: session ? <Dashboard /> : <Navigate to="/" replace /> },
    { path: '/analysis/:id', element: session ? <AnalysisDetail /> : <Navigate to="/" replace /> },
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <DebugLogger />
      <Toaster position="top-right" />
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </div>
  );
}
