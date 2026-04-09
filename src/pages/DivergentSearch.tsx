import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Search, X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Header } from '../components/Header';
import { OfflineIndicator } from '../components/OfflineIndicator';
import { useDivergentItems } from '../hooks/useDivergentItems';
import { normalizeSearchValue } from '../lib/search';
import { db } from '../lib/db';
import { AnalysisItem } from '../types';

interface ResolvedDivergentItem extends AnalysisItem {
  analysis_file_name: string;
}

export default function DivergentSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const divergentItems = useDivergentItems();
  const normalizedQuery = normalizeSearchValue(searchQuery.trim());

  const filteredItems = useMemo(() => {
    if (!normalizedQuery) return divergentItems;

    return divergentItems.filter((item) => (
      normalizeSearchValue(item.tag).includes(normalizedQuery) ||
      normalizeSearchValue(item.descricao).includes(normalizedQuery) ||
      normalizeSearchValue(item.patrimonio).includes(normalizedQuery) ||
      normalizeSearchValue(item.numero_serie).includes(normalizedQuery)
    ));
  }, [divergentItems, normalizedQuery]);

  const resolvedItems = useLiveQuery(async (): Promise<ResolvedDivergentItem[]> => {
    try {
      const allItems = await db.analysis_items.toArray();
      const resolved = allItems.filter((item) => item.found_in_analysis_id !== undefined && item.found_in_analysis_id !== null);
      const orderedResolved = resolved.sort(
        (a, b) => new Date(b.found_at || b.updated_at).getTime() - new Date(a.found_at || a.updated_at).getTime()
      );
      const analysisIds = Array.from(new Set(orderedResolved.map((item) => item.analysis_id)));
      const analyses = analysisIds.length ? await db.analyses.bulkGet(analysisIds) : [];
      const analysisNameById = new Map(
        analyses
          .filter((analysis): analysis is NonNullable<typeof analysis> => Boolean(analysis))
          .map((analysis) => [analysis.id, analysis.file_name || 'Ronda sem nome'])
      );
      return orderedResolved.map((item) => ({
        ...item,
        analysis_file_name: analysisNameById.get(item.analysis_id) || 'Ronda sem nome',
      }));
    } catch {
      return [];
    }
  }, []) || [];

  return (
    <div className="min-h-screen bg-slate-950 pb-20 text-slate-100 sm:pb-0">
      <OfflineIndicator />
      <Header title="Itens Divergentes" />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              <h2 className="text-lg font-semibold text-slate-100">Itens Divergentes</h2>
            </div>
            <span className="inline-flex w-fit items-center rounded-full border border-red-900/60 bg-red-950/40 px-3 py-1 text-xs font-semibold text-red-300">
              {divergentItems.length} total
            </span>
          </div>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por tag, descrição, patrimônio ou nº série..."
              className="block w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-10 text-sm text-slate-100 placeholder-slate-500 transition focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 inline-flex min-w-[44px] items-center justify-center text-slate-500 hover:text-slate-300"
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-sm">
          {divergentItems.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-400">Nenhum item divergente encontrado</div>
          ) : filteredItems.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-400">
              Nenhum resultado para '{searchQuery}'
            </div>
          ) : (
            <ul className="divide-y divide-slate-800">
              {filteredItems.map((item) => (
                <li key={item.id} className="px-4 py-4 sm:px-6">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-100">{item.tag || 'Sem tag'} · {item.descricao || 'Sem descrição'}</p>
                        <span className="inline-flex items-center rounded-full border border-red-900/60 bg-red-950/40 px-2 py-0.5 text-[11px] font-semibold text-red-300">
                          Divergência
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">Ronda: {item.analysis_file_name}</p>
                    </div>
                    <Link
                      to={`/analysis/${item.analysis_id}`}
                      className="inline-flex min-h-[36px] w-fit items-center justify-center rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-medium text-cyan-300 transition hover:bg-slate-800"
                    >
                      Abrir ronda
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-sm">
          <div className="border-b border-slate-800 bg-slate-950/70 px-4 py-3 sm:px-6">
            <h3 className="text-sm font-semibold text-slate-200">Resolvidos</h3>
          </div>
          {resolvedItems.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">Nenhum item resolvido até o momento</div>
          ) : (
            <ul className="divide-y divide-slate-800">
              {resolvedItems.map((item) => (
                <li key={item.id} className="px-4 py-4 sm:px-6">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-500">{item.tag || 'Sem tag'} · {item.descricao || 'Sem descrição'}</p>
                        <span className="inline-flex items-center rounded-full border border-emerald-900/60 bg-emerald-950/40 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                          Encontrado
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-300">Localizado em: {item.found_in_analysis_name || 'Ronda não informada'}</p>
                      <p className="mt-0.5 text-xs text-slate-500">Origem: {item.analysis_file_name}</p>
                    </div>
                    <Link
                      to={`/analysis/${item.analysis_id}`}
                      className="inline-flex min-h-[36px] w-fit items-center justify-center rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-medium text-cyan-300 transition hover:bg-slate-800"
                    >
                      Abrir ronda
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
