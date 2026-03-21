import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { addDebugLog } from '../lib/debug';

export function useAuth() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    addDebugLog('info', 'Carregando sessão');

    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (!isMounted) return;

        if (error) {
          addDebugLog('error', 'Erro ao carregar sessão', error);
        } else {
          addDebugLog('info', 'Sessão carregada', { authenticated: Boolean(session) });
        }

        setSession(session);
        setLoading(false);
      })
      .catch((error) => {
        if (!isMounted) return;
        addDebugLog('error', 'Falha inesperada ao carregar sessão', error);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      addDebugLog('info', 'Evento de autenticação recebido', { event, authenticated: Boolean(nextSession) });
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}
