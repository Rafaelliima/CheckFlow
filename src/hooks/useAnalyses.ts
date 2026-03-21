import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { queueMutation } from '../lib/sync';
import { Analysis } from '../types';
import { addDebugLog } from '../lib/debug';

export function useAnalyses(userId: string | undefined) {
  const analyses = useLiveQuery(async () => {
    if (!userId) return [];

    addDebugLog('info', 'Carregando análises', { userId });

    try {
      const ans = await db.analyses.orderBy('created_at').reverse().toArray();
      const items = await db.analysis_items.toArray();
      return ans.map(a => ({
        ...a,
        analysis_items: items.filter(i => i.analysis_id === a.id)
      }));
    } catch (error) {
      addDebugLog('error', 'Falha ao carregar análises no IndexedDB', error);
      return [];
    }
  }, [userId]) || [];

  const createAnalysis = async (fileName: string) => {
    if (!userId) return null;
    const analysisId = crypto.randomUUID();
    const now = new Date().toISOString();
    
    // In a real scenario we'd get email from session, but here we just mock it or leave empty
    const newAnalysis: Analysis = {
      id: analysisId,
      user_id: userId,
      created_by: userId,
      created_by_email: 'user@example.com',
      file_name: fileName,
      created_at: now,
      updated_at: now
    };
    
    try {
      await queueMutation('INSERT', 'analyses', analysisId, newAnalysis);
      return newAnalysis;
    } catch (error) {
      addDebugLog('error', 'Falha ao criar análise', error);
      throw error;
    }
  };

  const updateAnalysis = async (id: string, updates: Partial<Analysis>) => {
    try {
      const analysis = await db.analyses.get(id);
      if (!analysis) return;
      
      const updatedAnalysis = { ...analysis, ...updates, updated_at: new Date().toISOString() };
      await queueMutation('UPDATE', 'analyses', id, updatedAnalysis);
    } catch (error) {
      addDebugLog('error', 'Falha ao atualizar análise', error);
      throw error;
    }
  };

  const deleteAnalysis = async (id: string) => {
    try {
      await queueMutation('DELETE', 'analyses', id, { id });
    } catch (error) {
      addDebugLog('error', 'Falha ao excluir análise', error);
      throw error;
    }
  };

  return {
    analyses,
    createAnalysis,
    updateAnalysis,
    deleteAnalysis
  };
}
