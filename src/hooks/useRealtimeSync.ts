import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { db } from '../lib/db';
import { Analysis, AnalysisItem } from '../types';
import toast from 'react-hot-toast';

export function useRealtimeSync(analysisId: string | undefined) {
  useEffect(() => {
    if (!analysisId || !navigator.onLine) return;

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
        async (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldRecord = payload.old as { id: string };
            const localRecord = await db.analysis_items.get(oldRecord.id);
            if (localRecord) {
              await db.analysis_items.delete(oldRecord.id);
              toast('Item removido por outro usuário', { icon: '🗑️' });
            }
            return;
          }

          const newRecord = payload.new as AnalysisItem;
          if (!newRecord) return;

          const localRecord = await db.analysis_items.get(newRecord.id);
          
          // Last write wins
          if (!localRecord || new Date(newRecord.updated_at) > new Date(localRecord.updated_at)) {
            await db.analysis_items.put(newRecord);
            toast('Item atualizado por outro usuário', { icon: '🔄' });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'analyses',
          filter: `id=eq.${analysisId}`,
        },
        async (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldRecord = payload.old as { id: string };
            const localRecord = await db.analyses.get(oldRecord.id);
            if (localRecord) {
              await db.analyses.delete(oldRecord.id);
              toast('Análise removida por outro usuário', { icon: '🗑️' });
            }
            return;
          }

          const newRecord = payload.new as Analysis;
          if (!newRecord) return;

          const localRecord = await db.analyses.get(newRecord.id);
          
          // Last write wins
          if (!localRecord || new Date(newRecord.updated_at) > new Date(localRecord.updated_at)) {
            await db.analyses.put(newRecord);
            toast('Análise atualizada por outro usuário', { icon: '🔄' });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [analysisId]);
}
