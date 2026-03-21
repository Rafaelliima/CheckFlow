import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { db } from '../lib/db';
import { Analysis, AnalysisItem } from '../types';
import toast from 'react-hot-toast';
import { addDebugLog } from '../lib/debug';

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'degraded' | 'offline' | 'error';

const HEARTBEAT_INTERVAL_MS = 15000;
const HEARTBEAT_TIMEOUT_MS = 3000;
const DEGRADED_LATENCY_MS = 1500;
const OFFLINE_FAILURE_THRESHOLD = 3;
const ONLINE_SUCCESS_THRESHOLD = 1;

export function useRealtimeSync(analysisId: string | undefined) {
  const [status, setStatus] = useState<RealtimeStatus>(() => {
    if (!analysisId) return 'idle';
    return navigator.onLine ? 'connecting' : 'offline';
  });
  const [retryCount, setRetryCount] = useState(0);
  const channelRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const connectionGenerationRef = useRef(0);
  const processedEventKeysRef = useRef<Map<string, number>>(new Map());
  const heartbeatFailuresRef = useRef(0);
  const heartbeatSuccessesRef = useRef(0);
  const isRealtimeSubscribedRef = useRef(false);
  const recoveryModeRef = useRef(false);

  useEffect(() => {
    if (!analysisId) {
      setStatus('idle');
      return;
    }

    const clearReconnect = () => {
      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    const clearHeartbeat = () => {
      if (heartbeatIntervalRef.current !== null) {
        window.clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };

    const pruneProcessedEvents = () => {
      const now = Date.now();
      for (const [key, timestamp] of processedEventKeysRef.current.entries()) {
        if (now - timestamp > 30000) {
          processedEventKeysRef.current.delete(key);
        }
      }
    };

    const shouldProcessEvent = (eventKey: string) => {
      pruneProcessedEvents();
      if (processedEventKeysRef.current.has(eventKey)) return false;
      processedEventKeysRef.current.set(eventKey, Date.now());
      return true;
    };

    const cleanupChannel = () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      isRealtimeSubscribedRef.current = false;
    };

    const updateConnectivityStatus = (next: 'connected' | 'degraded' | 'offline') => {
      if (!navigator.onLine) {
        setStatus('offline');
        return;
      }

      if (next === 'offline') {
        setStatus('offline');
        return;
      }

      if (next === 'degraded') {
        setStatus('degraded');
        return;
      }

      setStatus(isRealtimeSubscribedRef.current ? 'connected' : 'connecting');
    };

    const heartbeat = async () => {
      if (!navigator.onLine) {
        heartbeatFailuresRef.current = OFFLINE_FAILURE_THRESHOLD;
        heartbeatSuccessesRef.current = 0;
        updateConnectivityStatus('offline');
        return;
      }

      const startedAt = performance.now();
      try {
        await Promise.race([
          supabase.from('analyses').select('id', { head: true, count: 'exact' }).limit(1),
          new Promise((_, reject) => {
            window.setTimeout(() => reject(new Error('heartbeat_timeout')), HEARTBEAT_TIMEOUT_MS);
          }),
        ]);

        const latency = performance.now() - startedAt;
        heartbeatFailuresRef.current = 0;
        heartbeatSuccessesRef.current += 1;

        if (latency > DEGRADED_LATENCY_MS) {
          heartbeatSuccessesRef.current = 0;
          recoveryModeRef.current = true;
          updateConnectivityStatus('degraded');
          return;
        }

        const recoveredEnough = !recoveryModeRef.current || heartbeatSuccessesRef.current >= ONLINE_SUCCESS_THRESHOLD;
        if (recoveredEnough) {
          recoveryModeRef.current = false;
          updateConnectivityStatus('connected');
          return;
        }

        updateConnectivityStatus('degraded');
      } catch (error) {
        heartbeatFailuresRef.current += 1;
        heartbeatSuccessesRef.current = 0;
        recoveryModeRef.current = true;
        addDebugLog('warn', 'Heartbeat de conectividade falhou', {
          analysisId,
          failures: heartbeatFailuresRef.current,
          error,
        });

        if (heartbeatFailuresRef.current >= OFFLINE_FAILURE_THRESHOLD) {
          updateConnectivityStatus('offline');
        } else {
          updateConnectivityStatus('degraded');
        }
      }
    };

    const startHeartbeat = () => {
      clearHeartbeat();
      heartbeat();
      heartbeatIntervalRef.current = window.setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
    };

    const scheduleReconnect = () => {
      if (!navigator.onLine) {
        updateConnectivityStatus('offline');
        return;
      }

      if (reconnectTimeoutRef.current !== null) return;

      const attempt = reconnectAttemptsRef.current;
      const delay = [1000, 2000, 4000, 8000, 10000][Math.min(attempt, 4)];
      reconnectAttemptsRef.current += 1;
      setRetryCount(reconnectAttemptsRef.current);
      updateConnectivityStatus('degraded');

      reconnectTimeoutRef.current = window.setTimeout(() => {
        reconnectTimeoutRef.current = null;
        connect();
      }, delay);
    };

    const handleAnalysisItemPayload = async (payload: any, generation: number) => {
      if (generation !== connectionGenerationRef.current) return;

      try {
        if (payload.eventType === 'DELETE') {
          const oldRecord = payload.old as { id: string };
          if (!shouldProcessEvent(`analysis_items:${oldRecord.id}:DELETE`)) return;
          const localRecord = await db.analysis_items.get(oldRecord.id);
          if (localRecord) {
            await db.analysis_items.delete(oldRecord.id);
            toast('Item removido por outro usuário', { icon: '🗑️' });
          }
          return;
        }

        const newRecord = payload.new as AnalysisItem;
        if (!newRecord) return;
        if (!shouldProcessEvent(`analysis_items:${newRecord.id}:${payload.eventType}:${newRecord.updated_at}`)) return;

        const localRecord = await db.analysis_items.get(newRecord.id);
        if (!localRecord || new Date(newRecord.updated_at) > new Date(localRecord.updated_at)) {
          await db.analysis_items.put(newRecord);
          toast('Item atualizado por outro usuário', { icon: '🔄' });
        }
      } catch (error) {
        addDebugLog('error', 'Falha no IndexedDB ao aplicar evento realtime de item', error);
      }
    };

    const handleAnalysisPayload = async (payload: any, generation: number) => {
      if (generation !== connectionGenerationRef.current) return;

      try {
        if (payload.eventType === 'DELETE') {
          const oldRecord = payload.old as { id: string };
          if (!shouldProcessEvent(`analyses:${oldRecord.id}:DELETE`)) return;
          const localRecord = await db.analyses.get(oldRecord.id);
          if (localRecord) {
            await db.analyses.delete(oldRecord.id);
            toast('Análise removida por outro usuário', { icon: '🗑️' });
          }
          return;
        }

        const newRecord = payload.new as Analysis;
        if (!newRecord) return;
        if (!shouldProcessEvent(`analyses:${newRecord.id}:${payload.eventType}:${newRecord.updated_at}`)) return;

        const localRecord = await db.analyses.get(newRecord.id);
        if (!localRecord || new Date(newRecord.updated_at) > new Date(localRecord.updated_at)) {
          await db.analyses.put(newRecord);
          toast('Análise atualizada por outro usuário', { icon: '🔄' });
        }
      } catch (error) {
        addDebugLog('error', 'Falha no IndexedDB ao aplicar evento realtime de análise', error);
      }
    };

    const connect = () => {
      clearReconnect();

      if (!navigator.onLine) {
        updateConnectivityStatus('offline');
        return;
      }

      cleanupChannel();
      setStatus((current) => (current === 'offline' ? 'degraded' : 'connecting'));
      addDebugLog('info', 'Conectando realtime', { analysisId, attempt: reconnectAttemptsRef.current + 1 });
      const generation = connectionGenerationRef.current + 1;
      connectionGenerationRef.current = generation;

      const channel = supabase
        .channel(`public:analysis_${analysisId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'analysis_items',
            filter: `analysis_id=eq.${analysisId}`,
          },
          (payload) => handleAnalysisItemPayload(payload, generation)
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'analyses',
            filter: `id=eq.${analysisId}`,
          },
          (payload) => handleAnalysisPayload(payload, generation)
        );

      channelRef.current = channel;
      channel.subscribe((subscriptionStatus: string) => {
        if (generation !== connectionGenerationRef.current) return;

        if (subscriptionStatus === 'SUBSCRIBED') {
          reconnectAttemptsRef.current = 0;
          setRetryCount(0);
          isRealtimeSubscribedRef.current = true;
          updateConnectivityStatus(heartbeatSuccessesRef.current > 0 ? 'connected' : 'degraded');
          return;
        }

        if (subscriptionStatus === 'CHANNEL_ERROR' || subscriptionStatus === 'TIMED_OUT' || subscriptionStatus === 'CLOSED') {
          isRealtimeSubscribedRef.current = false;
          cleanupChannel();
          scheduleReconnect();
        }
      });
    };

    const handleOnline = () => {
      heartbeatFailuresRef.current = 0;
      heartbeatSuccessesRef.current = 0;
      recoveryModeRef.current = true;
      reconnectAttemptsRef.current = 0;
      setRetryCount(0);
      startHeartbeat();
      connect();
    };

    const handleOffline = () => {
      clearReconnect();
      clearHeartbeat();
      cleanupChannel();
      heartbeatFailuresRef.current = OFFLINE_FAILURE_THRESHOLD;
      heartbeatSuccessesRef.current = 0;
      recoveryModeRef.current = true;
      updateConnectivityStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    startHeartbeat();
    connect();

    return () => {
      clearReconnect();
      clearHeartbeat();
      cleanupChannel();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [analysisId]);

  return { status, retryCount };
}
