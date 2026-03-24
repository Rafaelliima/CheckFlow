import { db } from './db';
import { supabase } from './supabase';
import { addDebugLog } from './debug';
import toast from 'react-hot-toast';

const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = [500, 1000, 2000];
const DEFAULT_PULL_LIMIT = 50;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let isQueueProcessing = false;
let currentProcessingPromise: Promise<void> | null = null;

type SyncProcessingStatus = {
  isProcessing: boolean;
  pendingCount: number;
};

type SyncStatusListener = (status: SyncProcessingStatus) => void;
const syncStatusListeners = new Set<SyncStatusListener>();
let currentSyncStatus: SyncProcessingStatus = { isProcessing: false, pendingCount: 0 };

const emitSyncStatus = (status: SyncProcessingStatus) => {
  currentSyncStatus = status;
  for (const listener of syncStatusListeners) {
    listener(status);
  }
};

export function subscribeSyncStatus(listener: SyncStatusListener) {
  syncStatusListeners.add(listener);
  listener(currentSyncStatus);
  return () => syncStatusListeners.delete(listener);
}

export async function processQueue() {
  if (!navigator.onLine) return;
  if (isQueueProcessing && currentProcessingPromise) {
    return currentProcessingPromise;
  }

  isQueueProcessing = true;
  currentProcessingPromise = (async () => {
    while (navigator.onLine) {
      let queue;
      try {
        queue = await db.sync_queue.orderBy('timestamp').toArray();
      } catch (error) {
        addDebugLog('error', 'Falha ao ler fila de sync no IndexedDB', error);
        emitSyncStatus({ isProcessing: false, pendingCount: 0 });
        return;
      }
      if (queue.length === 0) {
        emitSyncStatus({ isProcessing: false, pendingCount: 0 });
        return;
      }

      emitSyncStatus({ isProcessing: true, pendingCount: queue.length });
      let stoppedForError = false;

      for (const op of queue) {
        let attempt = op.retryCount ?? 0;

        try {
          if (op.action === 'INSERT') {
            const { error } = await supabase.from(op.table).insert(op.payload);
            // Ignore unique violation if it already exists (e.g., synced previously but queue didn't clear)
            if (error && error.code !== '23505') throw error; 
          } else if (op.action === 'UPDATE') {
            const { error } = await supabase.from(op.table).update(op.payload).eq('id', op.recordId);
            if (error) throw error;
          } else if (op.action === 'DELETE') {
            const { error } = await supabase.from(op.table).delete().eq('id', op.recordId);
            if (error) throw error;
          }
          await db.sync_queue.delete(op.id!);
          const remaining = await db.sync_queue.count();
          emitSyncStatus({ isProcessing: true, pendingCount: remaining });
        } catch (err) {
          addDebugLog('error', 'Falha ao sincronizar operação da fila', { op, attempt, err });
          attempt += 1;

          if (attempt >= MAX_RETRIES) {
            await db.failed_operations.add({
              action: op.action,
              table: op.table,
              recordId: op.recordId,
              payload: op.payload,
              timestamp: op.timestamp,
              retryCount: attempt,
              failedAt: Date.now(),
            });
            await db.sync_queue.delete(op.id!);
            toast.error('Não foi possível sincronizar alterações. Verifique sua conexão e tente novamente.');
            addDebugLog('error', 'Operação removida da fila após atingir limite de tentativas', { op, maxRetries: MAX_RETRIES });
            continue;
          }

          await db.sync_queue.update(op.id!, { retryCount: attempt, timestamp: Date.now() });
          await wait(RETRY_BACKOFF_MS[Math.min(attempt - 1, RETRY_BACKOFF_MS.length - 1)]);
          stoppedForError = true;
          break; // Stop processing on first error to maintain order
        }
      }

      const remainingAfterProcessing = await db.sync_queue.count();
      emitSyncStatus({ isProcessing: false, pendingCount: remainingAfterProcessing });
      if (stoppedForError || remainingAfterProcessing === 0) return;
    }
  })().finally(() => {
    isQueueProcessing = false;
    currentProcessingPromise = null;
  });

  await currentProcessingPromise;
}

type PullDataOptions = {
  limit?: number;
  beforeCreatedAt?: string | null;
};

type PullDataResult = {
  loaded: number;
  hasMore: boolean;
  nextBeforeCreatedAt: string | null;
};

export async function pullData(userId: string, options?: PullDataOptions): Promise<PullDataResult> {
  if (!navigator.onLine) {
    return {
      loaded: 0,
      hasMore: false,
      nextBeforeCreatedAt: null,
    };
  }

  const limit = options?.limit ?? DEFAULT_PULL_LIMIT;

  try {
    let analysesQuery = supabase
      .from('analyses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (options?.beforeCreatedAt) {
      analysesQuery = analysesQuery.lt('created_at', options.beforeCreatedAt);
    }

    const { data: analyses, error: anError } = await analysesQuery;
    if (anError) throw anError;
    
    if (analyses) {
      await db.analyses.bulkPut(analyses);
      
      // Pull items
      if (analyses.length > 0) {
        const analysisIds = analyses.map(a => a.id);
        const { data: items, error: itError } = await supabase.from('analysis_items').select('*').in('analysis_id', analysisIds);
        if (itError) throw itError;
        if (items) {
          await db.analysis_items.bulkPut(items);
        }
      }

      const nextBeforeCreatedAt = analyses.length > 0 ? analyses[analyses.length - 1].created_at : null;
      return {
        loaded: analyses.length,
        hasMore: analyses.length === limit,
        nextBeforeCreatedAt,
      };
    }
  } catch (err) {
    addDebugLog('error', 'Falha ao puxar dados remotos', { userId, options, err });
  }

  return {
    loaded: 0,
    hasMore: false,
    nextBeforeCreatedAt: null,
  };
}

export async function queueMutation(action: 'INSERT'|'UPDATE'|'DELETE', table: 'analyses'|'analysis_items', recordId: string, payload: any) {
  try {
    // 1. Update local DB immediately (Optimistic UI)
    try {
      if (action === 'INSERT' || action === 'UPDATE') {
        if (table === 'analyses') await db.analyses.put(payload);
        if (table === 'analysis_items') await db.analysis_items.put(payload);
      } else if (action === 'DELETE') {
        if (table === 'analyses') await db.analyses.delete(recordId);
        if (table === 'analysis_items') await db.analysis_items.delete(recordId);
      }
    } catch (localWriteError) {
      addDebugLog('error', 'Falha na escrita local antes de enfileirar mutação', { action, table, recordId, localWriteError });
      toast.error('Não foi possível salvar localmente. Tente novamente.');
      throw localWriteError;
    }

    // 2. Add to sync queue
    await db.sync_queue.add({
      action,
      table,
      recordId,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
    });
  } catch (error) {
    addDebugLog('error', 'Falha no IndexedDB ao enfileirar mutação', { action, table, recordId, error });
    throw error;
  }

  // 3. Try to process queue in background
  processQueue();
}

export async function retryFailedOperations() {
  const failedOperations = await db.failed_operations.orderBy('failedAt').toArray();
  if (failedOperations.length === 0) return 0;

  await db.transaction('rw', db.sync_queue, db.failed_operations, async () => {
    for (const failed of failedOperations) {
      await db.sync_queue.add({
        action: failed.action,
        table: failed.table,
        recordId: failed.recordId,
        payload: failed.payload,
        timestamp: Date.now(),
        retryCount: 0,
      });
    }
    await db.failed_operations.clear();
  });

  await processQueue();
  return failedOperations.length;
}
