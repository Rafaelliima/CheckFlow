import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Analysis, AnalysisItem } from '../types';
import { extractTextFromPDF } from '../lib/pdf';
import { decodeHtmlEntities, extractEquipmentFromText } from '../lib/gemini';
import { db } from '../lib/db';
import { pullData, queueMutation, retryFailedOperations } from '../lib/sync';
import { Header } from '../components/Header';
import { OfflineIndicator } from '../components/OfflineIndicator';
import { CheckCircle2, Clock, FilePlus, FileText, Loader2, Trash2, Upload, User as UserIcon } from 'lucide-react';
import toast from 'react-hot-toast';

export function normalizeImportedItem(item: {
  tag?: string;
  descricao?: string;
  modelo?: string;
  patrimonio?: string;
  numero_serie?: string;
}) {
  const tag = decodeHtmlEntities(item.tag || 'N/A');
  const descricao = decodeHtmlEntities(item.descricao || 'N/A');
  const modelo = decodeHtmlEntities(item.modelo || 'N/A');
  const patrimonio = decodeHtmlEntities(item.patrimonio || 'N/A');
  const numeroSerie = decodeHtmlEntities(item.numero_serie || 'N/A');

  return {
    tag,
    descricao,
    modelo,
    patrimonio,
    numero_serie: numeroSerie,
  };
}

type DashboardAnalysis = Analysis & { analysis_items: AnalysisItem[] };

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [deletingAnalysisId, setDeletingAnalysisId] = useState<string | null>(null);
  const [uploadStep, setUploadStep] = useState<'pdf' | 'ai' | 'saving' | 'done' | ''>('');
  const [uploadFileName, setUploadFileName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [remoteSearchResults, setRemoteSearchResults] = useState<Analysis[]>([]);
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [user, setUser] = useState<User | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreRemote, setHasMoreRemote] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [retryingFailedSync, setRetryingFailedSync] = useState(false);
  const [analysisToDeleteId, setAnalysisToDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const failedOperationsCount = useLiveQuery(() => db.failed_operations.count(), []) ?? 0;

  const analyses = useLiveQuery(async (): Promise<DashboardAnalysis[]> => {
    const ans = await db.analyses.orderBy('created_at').reverse().toArray();
    const items = await db.analysis_items.toArray();
    return ans.map(a => ({
      ...a,
      analysis_items: items.filter(i => i.analysis_id === a.id)
    }));
  }, []) || [];

  useEffect(() => {
    const checkUserAndFetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/');
        return;
      }
      
      setUser(session.user);
      const initialPull = await pullData(session.user.id, { limit: 50 });
      setHasMoreRemote(initialPull.hasMore);
      setNextCursor(initialPull.nextBeforeCreatedAt);
      setLoading(false);
    };
    
    checkUserAndFetchData();
  }, [navigate]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!user?.id || !isOnline || debouncedSearchQuery.length < 2) {
      setIsSearchingRemote(false);
      setRemoteSearchResults([]);
      return;
    }

    let cancelled = false;
    setIsSearchingRemote(true);

    (async () => {
      try {
        const { data, error } = await supabase
          .from('analyses')
          .select('*')
          .ilike('file_name', `%${debouncedSearchQuery}%`)
          .order('created_at', { ascending: false })
          .limit(20);

        if (cancelled) return;
        if (error) {
          toast.error('Falha ao buscar análises remotas.');
          setRemoteSearchResults([]);
        } else {
          setRemoteSearchResults((data || []) as Analysis[]);
        }
      } catch {
        if (cancelled) return;
        toast.error('Falha ao buscar análises remotas.');
        setRemoteSearchResults([]);
      } finally {
        if (cancelled) return;
        setIsSearchingRemote(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedSearchQuery, isOnline, user?.id]);

  const handleLoadMore = async () => {
    if (!user?.id || !nextCursor || loadingMore) return;
    setLoadingMore(true);

    try {
      const more = await pullData(user.id, { limit: 50, beforeCreatedAt: nextCursor });
      setHasMoreRemote(more.hasMore);
      setNextCursor(more.nextBeforeCreatedAt);
    } finally {
      setLoadingMore(false);
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setUploadFileName(file.name);
    setUploadStep('pdf');
    try {
      // 1. Extract text
      const text = await extractTextFromPDF(file);
      
      // 2. Send to Gemini
      setUploadStep('ai');
      const items = await extractEquipmentFromText(text);
      
      // 3. Create Analysis
      setUploadStep('saving');
      const analysisId = crypto.randomUUID();
      const fileName = `Análise PDF - ${file.name}`;
      const now = new Date().toISOString();
      
      const newAnalysis = {
        id: analysisId,
        user_id: user.id,
        created_by: user.id,
        created_by_email: user.email,
        file_name: fileName,
        created_at: now,
        updated_at: now
      };
      
      await queueMutation('INSERT', 'analyses', analysisId, newAnalysis);
      
      // 4. Insert Items
      if (items.length > 0) {
        for (const item of items) {
          const itemId = crypto.randomUUID();
          const normalizedItem = normalizeImportedItem(item);
          const newItem = {
            id: itemId,
            analysis_id: analysisId,
            ...normalizedItem,
            status: 'Pendente',
            created_at: now,
            updated_at: now
          };
          await queueMutation('INSERT', 'analysis_items', itemId, newItem);
        }
      }
      
      // 5. Show done state briefly and redirect
      setUploadStep('done');
      await new Promise((resolve) => setTimeout(resolve, 700));
      navigate(`/analysis/${analysisId}`);
    } catch (error) {
      console.error('Error processing PDF:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao processar o PDF. Tente novamente.');
    } finally {
      setUploadStep('');
      setUploadFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmDeleteAnalysis = (analysisId: string) => {
    setAnalysisToDeleteId(analysisId);
  };

  const handleDeleteAnalysis = async () => {
    if (!analysisToDeleteId) return;
    setDeletingAnalysisId(analysisToDeleteId);
    try {
      const selectedAnalysis = analyses.find((analysis) => analysis.id === analysisToDeleteId);
      const relatedItems = selectedAnalysis?.analysis_items || [];

      for (const item of relatedItems) {
        await queueMutation('DELETE', 'analysis_items', item.id, item);
      }

      await queueMutation('DELETE', 'analyses', analysisToDeleteId, selectedAnalysis || { id: analysisToDeleteId });
    } catch (error) {
      console.error('Error deleting analysis:', error);
      toast.error('Erro ao apagar análise.');
    } finally {
      setDeletingAnalysisId(null);
      setAnalysisToDeleteId(null);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  const normalizedQuery = debouncedSearchQuery.toLowerCase();
  const localFilteredAnalyses = analyses.filter((analysis) =>
    (analysis.file_name || '').toLowerCase().includes(normalizedQuery)
  );
  const mergedAnalyses = (() => {
    if (!isOnline || debouncedSearchQuery.length < 2) return localFilteredAnalyses;
    const mapById = new Map(localFilteredAnalyses.map((analysis) => [analysis.id, analysis]));
    for (const remoteAnalysis of remoteSearchResults) {
      if (!mapById.has(remoteAnalysis.id)) {
        mapById.set(remoteAnalysis.id, { ...remoteAnalysis, analysis_items: [] });
      }
    }
    return Array.from(mapById.values());
  })();

  return (
    <div className="min-h-screen pb-20 text-slate-100 sm:pb-0">
      {uploadStep && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/90 p-5 shadow-2xl shadow-black/50 backdrop-blur-xl">
            <div className="mb-4 flex items-center gap-3">
              {uploadStep === 'done' ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              ) : (
                <Loader2 className="h-6 w-6 animate-spin text-indigo-300" />
              )}
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  {uploadStep === 'done' ? 'Concluído' : 'Processando upload'}
                </h3>
                <p className="text-xs text-slate-400">{uploadFileName}</p>
              </div>
            </div>

            <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${uploadStep === 'done' ? 'bg-emerald-400' : 'bg-indigo-400'}`}
                style={{ width: `${uploadStep === 'pdf' ? 33 : uploadStep === 'ai' ? 66 : uploadStep === 'saving' ? 90 : 100}%` }}
              />
            </div>

            <div className="space-y-2">
              {[
                { key: 'pdf', label: 'Lendo PDF' },
                { key: 'ai', label: 'Analisando com IA' },
                { key: 'saving', label: 'Salvando dados' },
              ].map((step, index) => {
                const order = { pdf: 1, ai: 2, saving: 3, done: 4 } as const;
                const currentOrder = order[uploadStep];
                const stepOrder = index + 1;
                const isComplete = currentOrder > stepOrder;
                const isCurrent = currentOrder === stepOrder;

                return (
                  <div key={step.key} className="flex items-center gap-3">
                    <span
                      className={`inline-flex h-2.5 w-2.5 rounded-full ${
                        isComplete ? 'bg-emerald-400' : isCurrent ? 'bg-indigo-400 animate-pulse' : 'bg-slate-600'
                      }`}
                    />
                    <p className={`text-sm ${isComplete ? 'text-emerald-300' : isCurrent ? 'text-slate-100' : 'text-slate-500'}`}>
                      {step.label}
                    </p>
                  </div>
                );
              })}
              {uploadStep === 'done' && (
                <p className="pt-1 text-sm font-medium text-emerald-300">Dados salvos com sucesso.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <OfflineIndicator />
      <Header title="Dashboard" userEmail={user?.email} />

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">Minhas Análises</h2>
            <p className="mt-0.5 text-sm text-slate-400">Suas rondas e inspeções em um só lugar</p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto sm:gap-3">
            <input
              type="text"
              placeholder="Buscar análise..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full flex-1 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-100 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20 sm:w-64"
            />
            <div className="flex w-auto gap-2">
              <input 
                type="file" 
                accept="application/pdf" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!!uploadStep || !!deletingAnalysisId}
                className="flex h-10 w-[108px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-3 py-2 text-sm font-medium text-white shadow-md shadow-indigo-950/30 transition hover:from-indigo-400 hover:to-violet-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-50 sm:h-auto sm:w-auto sm:min-h-[44px] sm:px-4"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Upload PDF</span>
                <span className="sm:hidden">PDF</span>
              </button>
            </div>
          </div>
        </div>

        {failedOperationsCount > 0 && (
          <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 text-amber-100">
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

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-xl shadow-black/20 backdrop-blur-sm">
          <ul className="divide-y divide-white/5">
            {mergedAnalyses.length === 0 ? (
              <li className="px-4 py-16 text-center">
                <div className="mx-auto flex w-full max-w-xs flex-col items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
                    <FilePlus className="h-7 w-7 text-slate-500" />
                  </div>
                  {debouncedSearchQuery.length >= 2 ? (
                    <>
                      <p className="text-sm text-slate-300">Nenhuma análise encontrada para essa busca</p>
                      <p className="text-xs text-slate-500">Tente outro termo ou limpe a busca</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-slate-300">Nenhuma análise ainda</p>
                      <p className="text-xs text-slate-500">Faça upload de um PDF ou crie uma análise manual</p>
                    </>
                  )}
                </div>
              </li>
            ) : (
              mergedAnalyses.map((analysis) => {
                const totalItems = analysis.analysis_items?.length || 0;
                const completedItems = analysis.analysis_items?.filter(i => i.status !== 'Pendente').length || 0;
                const progressPercent = totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);

                return (
                  <li key={analysis.id} className="transition hover:bg-white/[0.03]">
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-start justify-between gap-3">
                        <div
                          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${
                            progressPercent === 100
                              ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20'
                              : 'bg-indigo-500/10 text-indigo-300 ring-indigo-500/20'
                          }`}
                        >
                          <FileText className="h-4 w-4" />
                        </div>
                        <Link to={`/analysis/${analysis.id}`} className="min-w-0 flex-1">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <p className="truncate text-base font-medium text-slate-100">
                              {analysis.file_name || 'Análise sem nome'}
                            </p>
                            <div className="flex-shrink-0">
                              <p className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold leading-none ${progressPercent === 100 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-indigo-500/10 text-indigo-200'}`}>
                                {progressPercent}%
                              </p>
                            </div>
                          </div>

                          <div className="sm:flex sm:justify-between">
                            <div className="sm:flex flex-col gap-1">
                              <p className="flex items-center text-sm text-slate-400">
                                <Clock className="mr-1.5 h-4 w-4 flex-shrink-0 text-slate-500" />
                                {new Date(analysis.created_at).toLocaleDateString('pt-BR')} às {new Date(analysis.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                              <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                                <UserIcon className="h-3 w-3" />
                                <span>{analysis.created_by_email || 'Usuário'}</span>
                              </div>
                            </div>
                            <div className="mt-2 flex items-center text-sm text-slate-400 sm:mt-0">
                              <p>{completedItems} de {totalItems} itens verificados</p>
                            </div>
                          </div>

                          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                            <div className={`h-1.5 rounded-full transition-all duration-500 ${progressPercent === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-violet-500'}`} style={{ width: `${progressPercent}%` }}></div>
                          </div>
                        </Link>

                <button
                  type="button"
                  onClick={() => confirmDeleteAnalysis(analysis.id)}
                  disabled={deletingAnalysisId === analysis.id}
                  className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-full border border-red-900/40 bg-red-500/5 text-red-300 transition hover:bg-red-500/15 disabled:opacity-50 sm:min-h-[44px] sm:min-w-[44px]"
                  aria-label={`Apagar análise ${analysis.file_name || analysis.id}`}
                  title="Apagar análise"
                >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
        {isSearchingRemote && (
          <p className="mt-2 text-center text-xs text-slate-400">Buscando...</p>
        )}

        {hasMoreRemote && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/[0.08] disabled:opacity-50"
            >
              {loadingMore ? 'Carregando...' : 'Carregar mais'}
            </button>
          </div>
        )}

        {analysisToDeleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
              <h3 className="text-base font-semibold text-slate-100">Confirmar exclusão</h3>
              <p className="mt-2 text-sm text-slate-300">
                Deseja apagar esta análise e todos os itens vinculados?
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAnalysisToDeleteId(null)}
                  disabled={!!deletingAnalysisId}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAnalysis}
                  disabled={!!deletingAnalysisId}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-950/50 disabled:opacity-50"
                >
                  {deletingAnalysisId ? 'Apagando...' : 'Confirmar exclusão'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
