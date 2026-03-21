import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AnalysisDetail from './pages/AnalysisDetail';
import { processQueue } from './lib/sync';
import { Toaster } from 'react-hot-toast';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Process queue on mount
    processQueue();

    // Process queue when coming back online
    const handleOnline = () => {
      console.log('App is online. Processing sync queue...');
      processQueue();
    };

    window.addEventListener('online', handleOnline);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  return (
    <>
      <Toaster position="top-right" />
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
    </>
  );
}
