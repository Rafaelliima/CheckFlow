import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { queueMutation } from '../lib/sync';
import { Analysis } from '../types';

export function useAnalyses(userId: string | undefined) {
  const analyses = useLiveQuery(async () => {
    if (!userId) return [];
    const ans = await db.analyses.orderBy('created_at').reverse().toArray();
    const items = await db.analysis_items.toArray();
    return ans.map(a => ({
      ...a,
      analysis_items: items.filter(i => i.analysis_id === a.id)
    }));
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
    
    await queueMutation('INSERT', 'analyses', analysisId, newAnalysis);
    return newAnalysis;
  };

  const updateAnalysis = async (id: string, updates: Partial<Analysis>) => {
    const analysis = await db.analyses.get(id);
    if (!analysis) return;
    
    const updatedAnalysis = { ...analysis, ...updates, updated_at: new Date().toISOString() };
    await queueMutation('UPDATE', 'analyses', id, updatedAnalysis);
  };

  const deleteAnalysis = async (id: string) => {
    await queueMutation('DELETE', 'analyses', id, { id });
  };

  return {
    analyses,
    createAnalysis,
    updateAnalysis,
    deleteAnalysis
  };
}
