import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { db } from '../lib/db';
import { Analysis, AnalysisItem } from '../types';
import toast from 'react-hot-toast';

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'offline' | 'error';

const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 10000];

export function useRealtimeSync(analysisId: string | undefined) {
  const [status, setStatus] = useState<RealtimeStatus>(() => {
    if (!analysisId) return 'idle';
    return navigator.onLine ? 'connecting' : 'offline';
  });
  const [retryCount, setRetryCount] = useState(0);
  const channelRef = useRef<any>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const connectionGenerationRef = useRef(0);
  const processedEventKeysRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!analysisId) {
      setStatus('idle');
      return;
    }

    const clearRetry = () => {
      if (retryTimeoutRef.current !== null) {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
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
    };

    const scheduleReconnect = () => {
      if (!navigator.onLine) {
        setStatus('offline');
        return;
      }

      if (retryTimeoutRef.current !== null) return;

      const attempt = reconnectAttemptsRef.current;
      const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
      reconnectAttemptsRef.current += 1;
      setRetryCount(reconnectAttemptsRef.current);
      setStatus('reconnecting');

      retryTimeoutRef.current = window.setTimeout(() => {
        retryTimeoutRef.current = null;
        connect();
      }, delay);
    };

    const handleAnalysisItemPayload = async (payload: any, generation: number) => {
      if (generation !== connectionGenerationRef.current) return;

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

      // Last write wins
      if (!localRecord || new Date(newRecord.updated_at) > new Date(localRecord.updated_at)) {
        await db.analysis_items.put(newRecord);
        toast('Item atualizado por outro usuário', { icon: '🔄' });
      }
    };

    const handleAnalysisPayload = async (payload: any, generation: number) => {
      if (generation !== connectionGenerationRef.current) return;

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

      // Last write wins
      if (!localRecord || new Date(newRecord.updated_at) > new Date(localRecord.updated_at)) {
        await db.analyses.put(newRecord);
        toast('Análise atualizada por outro usuário', { icon: '🔄' });
      }
    };

    const connect = () => {
      clearRetry();

      if (!navigator.onLine) {
        setStatus('offline');
        return;
      }

      cleanupChannel();
      setStatus(reconnectAttemptsRef.current > 0 ? 'reconnecting' : 'connecting');
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
          setStatus('connected');
          return;
        }

        if (subscriptionStatus === 'CHANNEL_ERROR') {
          setStatus('error');
          cleanupChannel();
          scheduleReconnect();
          return;
        }

        if (subscriptionStatus === 'TIMED_OUT' || subscriptionStatus === 'CLOSED') {
          setStatus('disconnected');
          cleanupChannel();
          scheduleReconnect();
        }
      });
    };

    const handleOnline = () => {
      reconnectAttemptsRef.current = 0;
      setRetryCount(0);
      connect();
    };

    const handleOffline = () => {
      clearRetry();
      cleanupChannel();
      setStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    connect();

    return () => {
      clearRetry();
      cleanupChannel();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [analysisId]);

  return { status, retryCount };
}
