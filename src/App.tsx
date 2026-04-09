import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { useEffect } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AnalysisDetail from './pages/AnalysisDetail';
import DivergentSearch from './pages/DivergentSearch';
import { processQueue } from './lib/sync';
import { Toaster } from 'react-hot-toast';
import { DebugLogger } from './components/DebugLogger';
import { ErrorBoundary } from './components/ErrorBoundary';
import { InstallBanner } from './components/InstallBanner';
import { useAuth } from './hooks/useAuth';
import { addDebugLog } from './lib/debug';

function LoadingScreen() {
  return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">Carregando...</div>;
}

function PublicRoute({ children }: { children: JSX.Element }) {
  const { session, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return session ? <Navigate to="/dashboard" replace /> : children;
}

function PrivateRoute({ children }: { children: JSX.Element }) {
  const { session, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return session ? children : <Navigate to="/" replace />;
}

const router = createBrowserRouter([
  { path: '/', element: <PublicRoute><Login /></PublicRoute> },
  { path: '/register', element: <PublicRoute><Register /></PublicRoute> },
  { path: '/dashboard', element: <PrivateRoute><Dashboard /></PrivateRoute> },
  { path: '/analysis/:id', element: <PrivateRoute><AnalysisDetail /></PrivateRoute> },
  { path: '/divergentes', element: <PrivateRoute><DivergentSearch /></PrivateRoute> },
]);

export default function App() {
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <DebugLogger />
      <Toaster position="top-right" />
      <InstallBanner />
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </div>
  );
}
