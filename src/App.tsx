import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AnalysisDetail from './pages/AnalysisDetail';
import { processQueue } from './lib/sync';
import { Toaster } from 'react-hot-toast';
import { DebugLogger } from './components/DebugLogger';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './components/ThemeProvider';
import { useAuth } from './hooks/useAuth';
import { addDebugLog } from './lib/debug';

export default function App() {
  const { session, loading } = useAuth();

  useEffect(() => {
    addDebugLog('info', 'Iniciando app');
    document.title = 'CheckFlow';

    // Process queue on mount
    processQueue();

    // Process queue when coming back online
    const handleOnline = () => {
      addDebugLog('info', 'App voltou a ficar online. Processando fila');
      processQueue();
    };

    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  return (
    <ThemeProvider>
      <DebugLogger />
      <Toaster position="top-right" />
      <ErrorBoundary>
        <Router>
          <Routes>
            <Route 
              path="/" 
              element={session ? <Navigate to="/dashboard" replace /> : <Login />} 
            />
            <Route 
              path="/register" 
              element={session ? <Navigate to="/dashboard" replace /> : <Register />} 
            />
            <Route 
              path="/dashboard" 
              element={session ? <Dashboard /> : <Navigate to="/" replace />} 
            />
            <Route 
              path="/analysis/:id" 
              element={session ? <AnalysisDetail /> : <Navigate to="/" replace />} 
            />
          </Routes>
        </Router>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
