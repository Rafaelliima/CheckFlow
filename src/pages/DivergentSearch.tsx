import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { supabase } from '../lib/supabase';
import { db } from '../lib/db';
import { queueMutation } from '../lib/sync';
import { useDivergentItems, DivergentItem } from '../hooks/useDivergentItems';
import { normalizeSearchValue } from '../lib/search';
import { Header } from '../components/Header';
import { OfflineIndicator } from '../components/OfflineIndicator';
import { Search, X, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DivergentSearch() {
  const divergentItems = useDivergentItems();
  const analyses = useLiveQuery(() => db.analyses.toArray(), []) || [];
  const [searchQuery, setSearchQuery] = useState('');
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);
  const [resolvingItem, setResolvingItem] = useState<DivergentItem | null>(null);
  const [resolveAnalysisId, setResolveAnalysisId] = useState('');
  const [resolving, setResolving] = useState(false);

  React.useEffect(() => {
    const loadSessionEmail = async () => {
      const auth = supabase.auth;
      if (!auth?.getSession) return;
      const { data: { session } } = await auth.getSession();
      setUserEmail(session?.user?.email);
    };

    loadSessionEmail();
  }, []);

  const filteredItems = divergentItems
    .filter((item) => {
      const q = normalizeSearchValue(searchQuery);
      if (!q) return true;
      return (
        normalizeSearchValue(item.tag).includes(q) ||
        normalizeSearchValue(item.descricao).includes(q) ||
        normalizeSearchValue(item.patrimonio).includes(q) ||
        normalizeSearchValue(item.numero_serie).includes(q) ||
        normalizeSearchValue(item.analysis_file_name).includes(q)
      );
    })
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const openResolveDialog = (item: DivergentItem) => {
    setResolvingItem(item);
    setResolveAnalysisId(item.analysis_id);
  };

  const closeResolveDialog = () => {
    if (resolving) return;
    setResolvingItem(null);
    setResolveAnalysisId('');
  };

  const handleConfirmResolve = async () => {
    if (!resolvingItem) return;
    setResolving(true);
    try {
      const targetAnalysis = analyses.find((a) => a.id === resolveAnalysisId);
      const updatedItem: Partial<DivergentItem> & Record<string, unknown> = {
        ...resolvingItem,
        found_in_analysis_id: resolveAnalysisId || resolvingItem.analysis_id,
        found_in_analysis_name: targetAnalysis?.file_name || resolvingItem.analysis_file_name,
        found_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      // analysis_file_name is a derived field from the hook, not part of the persisted record
      delete updatedItem.analysis_file_name;

      await queueMutation('UPDATE', 'analysis_items', resolvingItem.id, updatedItem);
      toast.success('Divergência marcada como resolvida.');
      setResolvingItem(null);
      setResolveAnalysisId('');
    } catch (error) {
      console.error('Error resolving divergent item:', error);
      toast.error('Erro ao marcar divergência como resolvida.');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="min-h-screen pb-24 text-slate-100">
      <OfflineIndicator />
      <Header title="Divergências" userEmail={userEmail} />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4 backdrop-blur-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Itens divergentes</h2>
            <p className="text-sm text-slate-400">
              Lista global de todos os itens marcados como Divergência em qualquer ronda, mesmo que já
              tenha sido fechada. Um item some daqui automaticamente quando o status dele deixa de ser
              "Divergência", ou pode ser marcado como resolvido manualmente abaixo.
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-5 w-5 text-slate-500" />
            </div>
            <input
              type="text"
              placeholder="Buscar por tag, descrição, patrimônio, nº série ou ronda..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-10 pr-10 leading-5 text-slate-100 placeholder-slate-500 shadow-sm outline-none transition focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20 sm:py-2 sm:text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 flex min-w-[44px] items-center justify-center pr-3 text-slate-500 hover:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-400">
            {filteredItems.length} divergência{filteredItems.length !== 1 ? 's' : ''} em aberto
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-xl shadow-black/20 backdrop-blur-sm">
          {/* Desktop Table View */}
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full divide-y divide-white/5">
              <thead className="bg-black/20">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Tag</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Descrição</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Nº Série</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Ronda</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      {searchQuery
                        ? 'Nenhuma divergência encontrada para a busca.'
                        : 'Nenhuma divergência em aberto no momento.'}
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="bg-white/[0.02]">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-slate-100">{item.tag || 'Sem tag'}</td>
                      <td className="px-6 py-4 text-sm text-slate-300">{item.descricao || 'Sem descrição'}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-300">{item.numero_serie || 'N/A'}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <Link to={`/analysis/${item.analysis_id}`} className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300">
                          {item.analysis_file_name}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <button
                          onClick={() => openResolveDialog(item)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/15"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Marcar resolvida
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="divide-y divide-white/5 md:hidden">
            {filteredItems.length === 0 ? (
              <div className="px-4 py-12 text-center text-slate-400">
                {searchQuery
                  ? 'Nenhuma divergência encontrada para a busca.'
                  : 'Nenhuma divergência em aberto no momento.'}
              </div>
            ) : (
              filteredItems.map((item) => (
                <div key={item.id} className="border-l-[3px] border-l-red-500 bg-white/[0.02] px-4 py-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span className="text-sm font-bold text-slate-100">{item.tag || 'Sem tag'}</span>
                    <span className="inline-flex items-center rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-semibold leading-5 text-red-300">
                      Divergência
                    </span>
                  </div>
                  <p className="mb-2 text-sm text-slate-300">{item.descricao || 'Sem descrição'}</p>
                  <div className="mb-3 grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-slate-400">
                    <div><span className="font-medium">Mod:</span> {item.modelo || 'N/A'}</div>
                    <div><span className="font-medium">Pat:</span> {item.patrimonio || 'N/A'}</div>
                    <div className="col-span-2"><span className="font-medium">NS:</span> {item.numero_serie || 'N/A'}</div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      to={`/analysis/${item.analysis_id}`}
                      className="inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300"
                    >
                      {item.analysis_file_name}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      onClick={() => openResolveDialog(item)}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/15"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Resolvida
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {resolvingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
            <h3 className="text-base font-semibold text-slate-100">Marcar divergência como resolvida</h3>
            <p className="mt-2 text-sm text-slate-300">
              O item <span className="font-semibold text-slate-100">{resolvingItem.tag || resolvingItem.descricao}</span> (Nº
              Série {resolvingItem.numero_serie || 'N/A'}) continuará marcado como "Divergência" na ronda de
              origem, mas sairá desta lista global. Indique em qual ronda ele foi encontrado/confirmado:
            </p>
            <select
              value={resolveAnalysisId}
              onChange={(e) => setResolveAnalysisId(e.target.value)}
              className="mt-3 block w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 shadow-sm outline-none focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20"
            >
              {analyses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.file_name || 'Ronda sem nome'}
                </option>
              ))}
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeResolveDialog}
                disabled={resolving}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/[0.06] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmResolve}
                disabled={resolving}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-50"
              >
                {resolving ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
