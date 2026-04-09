import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { AnalysisItem } from '../types';

export interface DivergentItem extends AnalysisItem {
  analysis_file_name: string;
}

export function useDivergentItems(): DivergentItem[] {
  return (
    useLiveQuery(async () => {
      try {
        const divergentItems = await db.analysis_items.where('status').equals('Divergência').toArray();
        const orderedItems = divergentItems.sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );

        const analysisIds = Array.from(new Set(orderedItems.map((item) => item.analysis_id)));
        const analyses = analysisIds.length ? await db.analyses.bulkGet(analysisIds) : [];
        const analysisNameById = new Map(
          analyses
            .filter((analysis): analysis is NonNullable<typeof analysis> => Boolean(analysis))
            .map((analysis) => [analysis.id, analysis.file_name || 'Ronda sem nome'])
        );

        return orderedItems.map((item) => ({
          ...item,
          analysis_file_name: analysisNameById.get(item.analysis_id) || 'Ronda sem nome',
        }));
      } catch {
        return [];
      }
    }, []) ?? []
  );
}
