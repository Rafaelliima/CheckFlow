import { db } from './db';
import { supabase } from './supabase';
import { addDebugLog } from './debug';

export async function processQueue() {
  if (!navigator.onLine) return;

  let queue;
  try {
    queue = await db.sync_queue.orderBy('timestamp').toArray();
  } catch (error) {
    addDebugLog('error', 'Falha ao ler fila de sync no IndexedDB', error);
    return;
  }
  if (queue.length === 0) return;

  for (const op of queue) {
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
    } catch (err) {
      console.error('Sync error for operation', op, err);
      break; // Stop processing on first error to maintain order
    }
  }
}

export async function pullData(userId: string) {
  if (!navigator.onLine) return;

  try {
    // Pull analyses
    const { data: analyses, error: anError } = await supabase.from('analyses').select('*');
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
    }
  } catch (err) {
    console.error('Pull error', err);
  }
}

export async function queueMutation(action: 'INSERT'|'UPDATE'|'DELETE', table: 'analyses'|'analysis_items', recordId: string, payload: any) {
  try {
    // 1. Update local DB immediately (Optimistic UI)
    if (action === 'INSERT' || action === 'UPDATE') {
      if (table === 'analyses') await db.analyses.put(payload);
      if (table === 'analysis_items') await db.analysis_items.put(payload);
    } else if (action === 'DELETE') {
      if (table === 'analyses') await db.analyses.delete(recordId);
      if (table === 'analysis_items') await db.analysis_items.delete(recordId);
    }

    // 2. Add to sync queue
    await db.sync_queue.add({
      action,
      table,
      recordId,
      payload,
      timestamp: Date.now()
    });
  } catch (error) {
    addDebugLog('error', 'Falha no IndexedDB ao enfileirar mutação', { action, table, recordId, error });
    throw error;
  }

  // 3. Try to process queue in background
  processQueue();
}
