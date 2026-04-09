import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link, useBeforeUnload, useBlocker } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { supabase } from '../lib/supabase';
import { AnalysisItem } from '../types';
import { db } from '../lib/db';
import { queueMutation, retryFailedOperations } from '../lib/sync';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { AnalysisPDF } from '../components/AnalysisPDF';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { Header } from '../components/Header';
import { OfflineIndicator } from '../components/OfflineIndicator';
import { RealtimeStatusIndicator } from '../components/RealtimeStatusIndicator';
import { Search, X, Edit2, FileDown, Trash2 } from 'lucide-react';
import { addDebugLog } from '../lib/debug';
import { normalizeSearchValue } from '../lib/search';
import { useDivergentItems } from '../hooks/useDivergentItems';
import toast from 'react-hot-toast';

export function sortAnalysisItems<T extends Pick<AnalysisItem, 'status' | 'created_at'>>(items: T[]) {
  const statusPriority = { Pendente: 0, OK: 1, Divergência: 2 } as const;

  return [...items].sort((a, b) => {
    const priorityDiff = statusPriority[a.status as keyof typeof statusPriority] - statusPriority[b.status as keyof typeof statusPriority];

    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function statusBorderClass(status: string) {
  if (status === 'OK') return 'border-l-emerald-500';
  if (status === 'Divergência') return 'border-l-red-500';
  return 'border-l-amber-500';
}

function statusToggleClass(buttonStatus: string, currentStatus: string) {
  if (buttonStatus === currentStatus) {
    if (buttonStatus === 'Pendente') return 'bg-amber-950/60 text-amber-400';
    if (buttonStatus === 'OK') return 'bg-emerald-950/50 text-emerald-400';
    return 'bg-red-950/50 text-red-400';
  }
  return 'bg-transparent text-slate-600 hover:text-slate-400';
}

export default function AnalysisDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { status: realtimeStatus } = useRealtimeSync(id);

  const analysis = useLiveQuery(() => id ? db.analyses.get(id) : undefined, [id]);
  const items = useLiveQuery(() => id ? db.analysis_items.where('analysis_id').equals(id).reverse().sortBy('created_at') : [], [id]) || [];
  const divergentItems = useDivergentItems();
  const failedOperationsCount = useLiveQuery(() => db.failed_operations.count(), []) ?? 0;
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [deletingAnalysis, setDeletingAnalysis] = useState(false);
  const [retryingFailedSync, setRetryingFailedSync] = useState(false);
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);

  // Notes state
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const isNotesFocusedRef = useRef(false);
  const notesLastSyncedAtRef = useRef<string | null>(null);
  const pendingRemoteNotesRef = useRef<{ notes: string; updatedAt: string } | null>(null);

  // Edit state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AnalysisItem>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const hasUnsavedChanges = editingItemId !== null || notes !== (analysis?.notes || '');
  const navigationBlocker = useBlocker(hasUnsavedChanges);

  useEffect(() => {
    const loadSessionEmail = async () => {
      const auth = supabase.auth;
      if (!auth?.getSession) return;
      const { data: { session } } = await auth.getSession();
      setUserEmail(session?.user?.email);
    };

    loadSessionEmail();
  }, []);

  useEffect(() => {
    if (!analysis) {
      setLoading(false);
      return;
    }

    const remoteUpdatedAt = analysis.updated_at || analysis.created_at;
    const remoteNotes = analysis.notes || '';
    const hasNeverSynced = notesLastSyncedAtRef.current === null;
    const isRemoteNewer =
      hasNeverSynced ||
      new Date(remoteUpdatedAt).getTime() > new Date(notesLastSyncedAtRef.current || 0).getTime();

    if (!isNotesFocusedRef.current) {
      setNotes(remoteNotes);
      notesLastSyncedAtRef.current = remoteUpdatedAt;
      pendingRemoteNotesRef.current = null;
    } else if (isRemoteNewer) {
      pendingRemoteNotesRef.current = {
        notes: remoteNotes,
        updatedAt: remoteUpdatedAt,
      };
    }

    setLoading(false);
  }, [analysis]);

  useEffect(() => {
    addDebugLog('info', 'Renderizando análise', { analysisId: id, hasAnalysis: Boolean(analysis) });
  }, [id, analysis]);

  useEffect(() => {
    if (!analysis?.id) return;
    addDebugLog('info', 'Renderizando botão PDF', { analysisId: analysis.id });
  }, [analysis?.id]);

  const handleDeleteAnalysis = async () => {
    if (!id) return;

    const confirmed = window.confirm('Deseja apagar esta análise e todos os itens vinculados?');
    if (!confirmed) return;

    setDeletingAnalysis(true);
    try {
      for (const item of items) {
        await queueMutation('DELETE', 'analysis_items', item.id, item);
      }

      await queueMutation('DELETE', 'analyses', id, analysis);
      navigate('/dashboard');
    } catch (error) {
      console.error('Error deleting analysis:', error);
      toast.error('Erro ao apagar análise.');
    } finally {
      setDeletingAnalysis(false);
    }
  };

  const handleUpdateStatus = async (itemId: string, newStatus: string) => {
    try {
      const item = items.find(i => i.id === itemId);
      if (!item) return;
      
      const updatedItem = { ...item, status: newStatus, updated_at: new Date().toISOString() };
      await queueMutation('UPDATE', 'analysis_items', itemId, updatedItem);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar status.');
    }
  };

  const handleSaveNotes = async () => {
    if (!id || !analysis) return;
    setSavingNotes(true);
    try {
      const updatedAnalysis = { ...analysis, notes, updated_at: new Date().toISOString() };
      await queueMutation('UPDATE', 'analyses', id, updatedAnalysis);
      notesLastSyncedAtRef.current = updatedAnalysis.updated_at;
      pendingRemoteNotesRef.current = null;
    } catch (error) {
      console.error('Error saving notes:', error);
      toast.error('Erro ao salvar notas.');
    } finally {
      setSavingNotes(false);
    }
  };

  const startEditing = (item: AnalysisItem) => {
    setEditingItemId(item.id);
    setEditForm(item);
  };

  const handleSaveEdit = async () => {
    if (!editingItemId) return;
    setSavingEdit(true);
    try {
      const item = items.find(i => i.id === editingItemId);
      if (!item) return;
      
      const updatedItem = { 
        ...item, 
        ...editForm, 
        updated_at: new Date().toISOString() 
      };
      await queueMutation('UPDATE', 'analysis_items', editingItemId, updatedItem);
      
      setEditingItemId(null);
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error('Erro ao atualizar item.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRetryFailedSync = async () => {
    setRetryingFailedSync(true);
    try {
      const requeued = await retryFailedOperations();
      if (requeued > 0) {
        toast.success('Tentativa de sincronização iniciada.');
      }
    } catch (error) {
      console.error('Error retrying failed sync operations:', error);
      toast.error('Não foi possível reenfileirar alterações pendentes.');
    } finally {
      setRetryingFailedSync(false);
    }
  };

  useBeforeUnload((event) => {
    if (!hasUnsavedChanges) return;
    event.preventDefault();
    event.returnValue = '';
  });

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  if (!analysis) {
    return <div className="min-h-screen flex items-center justify-center">Análise não encontrada.</div>;
  }

  const filteredItems = sortAnalysisItems(items.filter(item => {
    const q = normalizeSearchValue(searchQuery);
    return (
      normalizeSearchValue(item.tag).includes(q) ||
      normalizeSearchValue(item.descricao).includes(q) ||
      normalizeSearchValue(item.patrimonio).includes(q) ||
      normalizeSearchValue(item.numero_serie).includes(q)
    );
  }));
  const hasActiveSearch = searchQuery.trim() !== '';

  const divergentWarningByItemId = new Map(
    filteredItems.map((item) => {
      const matchingDivergence = divergentItems.find((divergentItem) => {
        if (divergentItem.analysis_id === id) return false;

        const itemTag = normalizeSearchValue(item.tag);
        const itemPatrimonio = normalizeSearchValue(item.patrimonio);
        const itemNumeroSerie = normalizeSearchValue(item.numero_serie);

        const divergentTag = normalizeSearchValue(divergentItem.tag);
        const divergentPatrimonio = normalizeSearchValue(divergentItem.patrimonio);
        const divergentNumeroSerie = normalizeSearchValue(divergentItem.numero_serie);

        const tagMatches = itemTag && itemTag !== 'n/a' && itemTag === divergentTag;
        const patrimonioMatches = itemPatrimonio && itemPatrimonio !== 'n/a' && itemPatrimonio === divergentPatrimonio;
        const numeroSerieMatches = itemNumeroSerie && itemNumeroSerie !== 'n/a' && itemNumeroSerie === divergentNumeroSerie;

        return tagMatches || patrimonioMatches || numeroSerieMatches;
      });

      return [item.id, matchingDivergence?.analysis_file_name];
    })
  );

  const totalItems = items.length;
  const completedItems = items.filter(i => i.status !== 'Pendente').length;
  const progressPercent = totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);

  return (
    <div className="min-h-screen bg-slate-950 pb-24 text-slate-100">
      <OfflineIndicator />
      <Header
        title={analysis.file_name || 'Análise'}
        userEmail={userEmail}
        mobileStatusIndicator={<RealtimeStatusIndicator status={realtimeStatus} variant="compact" />}
        mobileMenuChildren={(
          <>
            <PDFDownloadLink
              document={<AnalysisPDF analysis={analysis} items={items} />}
              fileName={`relatorio-${analysis.id}.pdf`}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-base font-medium text-slate-100 transition hover:bg-slate-800 hover:text-cyan-300"
            >
              {({ loading }) => (
                <>
                  <FileDown className="h-5 w-5" />
                  {loading ? 'Gerando PDF...' : 'Baixar PDF'}
                </>
              )}
            </PDFDownloadLink>
            <button
              type="button"
              onClick={handleDeleteAnalysis}
              disabled={deletingAnalysis}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-base font-medium text-red-300 transition hover:bg-red-950/40 disabled:opacity-50"
            >
              <Trash2 className="h-5 w-5" />
              {deletingAnalysis ? 'Apagando análise...' : 'Apagar análise'}
            </button>
          </>
        )}
      >
        <RealtimeStatusIndicator status={realtimeStatus} className="hidden sm:block" />
        <button
          type="button"
          onClick={handleDeleteAnalysis}
          disabled={deletingAnalysis}
          className="hidden min-h-[44px] items-center justify-center rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-950/50 disabled:opacity-50 sm:inline-flex"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          <span>{deletingAnalysis ? 'Apagando...' : 'Apagar análise'}</span>
        </button>
        <PDFDownloadLink
          document={<AnalysisPDF analysis={analysis} items={items} />}
          fileName={`relatorio-${analysis.id}.pdf`}
          className="hidden min-h-[44px] items-center justify-center rounded-lg border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:inline-flex"
        >
          {({ loading }) => (
            <>
              <FileDown className="mr-2 h-4 w-4" />
              <span>{loading ? 'Gerando...' : 'Exportar PDF'}</span>
            </>
          )}
        </PDFDownloadLink>
      </Header>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {failedOperationsCount > 0 && (
          <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-amber-100">
            <p className="text-sm font-medium">
              {failedOperationsCount} alteração(ões) não foram sincronizadas. Tente novamente ou recarregue a página.
            </p>
            <button
              type="button"
              onClick={handleRetryFailedSync}
              disabled={retryingFailedSync}
              className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-lg border border-amber-400/50 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-amber-500/10 disabled:opacity-50"
            >
              {retryingFailedSync ? 'Tentando...' : 'Tentar novamente'}
            </button>
          </div>
        )}

        {/* Progress and Summary */}
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Progresso da Análise</h2>
              <p className="text-sm text-slate-400">{completedItems} de {totalItems} itens verificados</p>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-3xl font-bold text-indigo-600 dark:text-cyan-300">{progressPercent}%</span>
            </div>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className={`h-3 rounded-full transition-all duration-500 ${progressPercent === 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`} style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-500" />
            </div>
            <input
              type="text"
              placeholder="Buscar por tag, descrição, patrimônio ou nº série..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full rounded-lg border border-slate-700 bg-slate-900 py-3 pl-10 pr-10 leading-5 text-slate-100 placeholder-slate-500 transition focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-500 sm:py-2 sm:text-sm"
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
          {searchQuery && (
            <p className="mt-2 text-sm text-slate-400">
              {filteredItems.length} resultado{filteredItems.length !== 1 ? 's' : ''} encontrado{filteredItems.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Notes */}
          <div className="lg:col-span-1 order-2 lg:order-1">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm sm:p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-100">Notas Gerais</h2>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onFocus={() => {
                  isNotesFocusedRef.current = true;
                }}
                onBlur={() => {
                  isNotesFocusedRef.current = false;
                  const pendingRemote = pendingRemoteNotesRef.current;
                  if (!pendingRemote) return;

                  const isPendingRemoteNewer =
                    new Date(pendingRemote.updatedAt).getTime() > new Date(notesLastSyncedAtRef.current || 0).getTime();
                  if (!isPendingRemoteNewer) return;

                  setNotes(pendingRemote.notes);
                  notesLastSyncedAtRef.current = pendingRemote.updatedAt;
                  pendingRemoteNotesRef.current = null;
                  toast('Notas atualizadas por outro usuário.', { icon: 'ℹ️' });
                }}
                className="block w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 shadow-sm transition focus:border-cyan-400 focus:outline-none focus:ring-cyan-500 sm:text-sm"
                placeholder="Observações gerais sobre esta análise..."
              />
              <button
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="mt-4 flex min-h-[44px] w-full justify-center rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-medium text-slate-100 shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 sm:py-2"
              >
                {savingNotes ? 'Salvando...' : 'Salvar Notas'}
              </button>
            </div>
          </div>

          {/* List of items */}
          <div className="lg:col-span-2 order-1 lg:order-2">
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 px-4 py-4 sm:px-6">
                <h3 className="text-lg font-semibold text-slate-100">Itens da Análise</h3>
              </div>
              
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-800">
                  <thead className="bg-slate-950/70">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Tag</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Descrição</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Status</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                          {hasActiveSearch ? 'Nenhum item encontrado para a busca.' : 'Nenhum item adicionado ainda.'}
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item) => (
                        <tr key={item.id} className={item.status === 'Pendente' ? 'bg-slate-900' : 'bg-slate-900/70'}>
                          {editingItemId === item.id ? (
                            <td colSpan={4} className="px-6 py-4">
                              <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">Tag</label>
                                  <input type="text" value={editForm.tag || ''} onChange={e => setEditForm({...editForm, tag: e.target.value})} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-slate-700">Descrição</label>
                                  <input type="text" value={editForm.descricao || ''} onChange={e => setEditForm({...editForm, descricao: e.target.value})} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-slate-700">Modelo</label>
                                  <input type="text" value={editForm.modelo || ''} onChange={e => setEditForm({...editForm, modelo: e.target.value})} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-slate-700">Patrimônio</label>
                                  <input type="text" value={editForm.patrimonio || ''} onChange={e => setEditForm({...editForm, patrimonio: e.target.value})} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-slate-700">Nº Série</label>
                                  <input type="text" value={editForm.numero_serie || ''} onChange={e => setEditForm({...editForm, numero_serie: e.target.value})} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                                </div>
                              </div>
                              <div className="flex space-x-2">
                                <button onClick={handleSaveEdit} disabled={savingEdit} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 min-h-[44px]">
                                  {savingEdit ? 'Salvando...' : 'Salvar'}
                                </button>
                                <button onClick={() => setEditingItemId(null)} disabled={savingEdit} className="min-h-[44px] rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600">
                                  Cancelar
                                </button>
                              </div>
                            </td>
                          ) : (
                            <>
                              <td className={`whitespace-nowrap border-l-[3px] px-5 py-4 text-sm font-medium text-slate-100 ${statusBorderClass(item.status)}`}>
                                <div className="flex items-center">
                                  {item.tag}
                                  <button onClick={() => startEditing(item)} className="ml-2 p-1 text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-cyan-300" title="Editar">
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-400">
                                {item.descricao || 'Sem descrição'}
                                {(item.modelo !== 'N/A' || item.patrimonio !== 'N/A') && (
                                  <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                    Mod: {item.modelo || 'N/A'} | Pat: {item.patrimonio || 'N/A'}
                                  </div>
                                )}
                                {hasActiveSearch && divergentWarningByItemId.get(item.id) && (
                                  <div className="mt-1 text-xs text-amber-400">
                                    ⚠ Divergência registrada em "{divergentWarningByItemId.get(item.id)}"
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                                  ${item.status === 'OK' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 
                                    item.status === 'Divergência' ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300' : 
                                    'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'}`}>
                                  {item.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="inline-flex overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
                                  {(['Pendente', 'OK', 'Divergência'] as const).map((statusOption) => (
                                    <button
                                      key={statusOption}
                                      onClick={() => {
                                        if (statusOption !== item.status) {
                                          handleUpdateStatus(item.id, statusOption);
                                        }
                                      }}
                                      title={`Marcar como ${statusOption}`}
                                      className={`min-h-[36px] px-3 text-xs font-semibold transition ${statusToggleClass(statusOption, item.status)}`}
                                    >
                                      {statusOption}
                                    </button>
                                  ))}
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="divide-y divide-slate-200 dark:divide-slate-800 md:hidden">
                {filteredItems.length === 0 ? (
                  <div className="px-4 py-12 text-center text-slate-400">
                    {hasActiveSearch ? 'Nenhum item encontrado para a busca.' : 'Nenhum item adicionado ainda.'}
                  </div>
                ) : (
                  filteredItems.map((item) => (
                    <div key={item.id} className={`border-l-[3px] px-4 py-3 ${statusBorderClass(item.status)} ${item.status === 'Pendente' ? 'bg-slate-900' : 'bg-slate-900/70'}`}>
                      {editingItemId === item.id ? (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">Tag</label>
                            <input type="text" value={editForm.tag || ''} onChange={e => setEditForm({...editForm, tag: e.target.value})} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700">Descrição</label>
                            <input type="text" value={editForm.descricao || ''} onChange={e => setEditForm({...editForm, descricao: e.target.value})} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-slate-700">Modelo</label>
                              <input type="text" value={editForm.modelo || ''} onChange={e => setEditForm({...editForm, modelo: e.target.value})} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-700">Patrimônio</label>
                              <input type="text" value={editForm.patrimonio || ''} onChange={e => setEditForm({...editForm, patrimonio: e.target.value})} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700">Nº Série</label>
                            <input type="text" value={editForm.numero_serie || ''} onChange={e => setEditForm({...editForm, numero_serie: e.target.value})} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                          </div>
                          <div className="flex space-x-3 pt-2">
                            <button onClick={handleSaveEdit} disabled={savingEdit} className="min-h-[44px] flex-1 rounded-lg bg-indigo-600 py-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400">
                              {savingEdit ? 'Salvando...' : 'Salvar'}
                            </button>
                            <button onClick={() => setEditingItemId(null)} disabled={savingEdit} className="min-h-[44px] flex-1 rounded-lg bg-slate-200 py-3 text-sm font-medium text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600">
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-100">{item.tag || 'Sem tag'}</span>
                              <button onClick={() => startEditing(item)} className="flex min-h-[44px] min-w-[44px] items-center justify-center p-2 text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-cyan-300" title="Editar">
                                <Edit2 className="w-4 h-4" />
                              </button>
                            </div>
                            <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                              ${item.status === 'OK' ? 'bg-emerald-100 text-emerald-800' : 
                                item.status === 'Divergência' ? 'bg-red-100 text-red-800' : 
                                'bg-amber-100 text-amber-800'}`}>
                              {item.status}
                            </span>
                          </div>
                          <p className="mb-2 text-sm text-slate-300">{item.descricao || 'Sem descrição'}</p>
                          <div className="mb-4 grid grid-cols-2 gap-2 rounded border border-slate-800 bg-slate-950 p-2 text-xs text-slate-400">
                            <div><span className="font-medium">Mod:</span> {item.modelo || 'N/A'}</div>
                            <div><span className="font-medium">Pat:</span> {item.patrimonio || 'N/A'}</div>
                            <div className="col-span-2"><span className="font-medium">NS:</span> {item.numero_serie || 'N/A'}</div>
                          </div>
                          {hasActiveSearch && divergentWarningByItemId.get(item.id) && (
                            <p className="mb-2 text-xs text-amber-400">
                              ⚠ Divergência registrada em "{divergentWarningByItemId.get(item.id)}"
                            </p>
                          )}
                          <div className="inline-flex w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
                            {(['Pendente', 'OK', 'Divergência'] as const).map((statusOption) => (
                              <button
                                key={statusOption}
                                onClick={() => {
                                  if (statusOption !== item.status) {
                                    handleUpdateStatus(item.id, statusOption);
                                  }
                                }}
                                title={`Marcar como ${statusOption}`}
                                className={`min-h-[40px] flex-1 px-2 text-xs font-semibold transition ${statusToggleClass(statusOption, item.status)}`}
                              >
                                {statusOption}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {navigationBlocker.state === 'blocked' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-lg">
            <h3 className="text-base font-semibold text-slate-100">Sair sem salvar?</h3>
            <p className="mt-2 text-sm text-slate-300">
              Você tem edições não salvas. Se sair agora, as alterações em andamento podem ser perdidas.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => navigationBlocker.reset()}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
              >
                Continuar editando
              </button>
              <button
                type="button"
                onClick={() => navigationBlocker.proceed()}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-rose-900/60 bg-rose-950/30 px-4 py-2 text-sm font-medium text-rose-200 hover:bg-rose-950/50"
              >
                Sair sem salvar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
