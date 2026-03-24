import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { supabase } from '../lib/supabase';
import { Analysis } from '../types';
import { extractTextFromPDF } from '../lib/pdf';
import { extractEquipmentFromText } from '../lib/gemini';
import { db } from '../lib/db';
import { pullData, queueMutation } from '../lib/sync';
import { Header } from '../components/Header';
import { OfflineIndicator } from '../components/OfflineIndicator';
import { Clock, Trash2, Upload, User } from 'lucide-react';


export function normalizeImportedItem(item: {
  tag?: string;
  descricao?: string;
  modelo?: string;
  patrimonio?: string;
  numero_serie?: string;
}) {
  return {
    tag: item.tag || 'N/A',
    descricao: item.descricao || 'N/A',
    modelo: item.modelo || 'N/A',
    patrimonio: item.numero_serie || item.patrimonio || 'N/A',
    numero_serie: item.patrimonio || item.numero_serie || 'N/A',
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [deletingAnalysisId, setDeletingAnalysisId] = useState<string | null>(null);
  const [uploadStep, setUploadStep] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<any>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreRemote, setHasMoreRemote] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analyses = useLiveQuery(async () => {
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
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
      
      // 5. Redirect
      navigate(`/analysis/${analysisId}`);
    } catch (error) {
      console.error('Error processing PDF:', error);
      alert('Erro ao processar o PDF.');
    } finally {
      setUploadStep('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAnalysis = async (analysisId: string) => {
    const confirmed = window.confirm('Deseja apagar esta análise e todos os itens vinculados?');
    if (!confirmed) return;

    setDeletingAnalysisId(analysisId);
    try {
      const selectedAnalysis = analyses.find((analysis) => analysis.id === analysisId);
      const relatedItems = selectedAnalysis?.analysis_items || [];

      for (const item of relatedItems) {
        await queueMutation('DELETE', 'analysis_items', item.id, item);
      }

      await queueMutation('DELETE', 'analyses', analysisId, selectedAnalysis || { id: analysisId });
    } catch (error) {
      console.error('Error deleting analysis:', error);
      alert('Erro ao apagar análise.');
    } finally {
      setDeletingAnalysisId(null);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  const normalizedQuery = searchQuery.toLowerCase();
  const filteredAnalyses = analyses.filter((analysis) =>
    (analysis.file_name || '').toLowerCase().includes(normalizedQuery)
  );

  return (
    <div className="min-h-screen bg-slate-950 pb-20 text-slate-100 sm:pb-0">
      <OfflineIndicator />
      <Header title="CheckFlow Dashboard" />

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
          <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">Minhas Análises</h2>
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Buscar análise..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-base text-slate-100 shadow-sm transition focus:border-cyan-400 focus:ring-cyan-500 sm:w-64 sm:py-2 sm:text-sm"
            />
            <div className="flex gap-2 w-full sm:w-auto">
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
                className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 sm:flex-none sm:py-2"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {uploadStep === 'pdf' ? 'Lendo...' : 
                   uploadStep === 'ai' ? 'Analisando...' : 
                   uploadStep === 'saving' ? 'Salvando...' : 'Upload PDF'}
                </span>
                <span className="sm:hidden">PDF</span>
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-sm">
          <ul className="divide-y divide-slate-800">
            {filteredAnalyses.length === 0 ? (
              <li className="px-4 py-12 text-center text-slate-400">
                Nenhuma análise encontrada.
              </li>
            ) : (
              filteredAnalyses.map((analysis) => {
                const totalItems = analysis.analysis_items?.length || 0;
                const completedItems = analysis.analysis_items?.filter(i => i.status !== 'Pendente').length || 0;
                const progressPercent = totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);

                return (
                  <li key={analysis.id}>
                    <div className="px-4 py-4 sm:px-6">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <Link to={`/analysis/${analysis.id}`} className="min-w-0 flex-1">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="truncate pr-4 text-base font-medium text-cyan-300">
                              {analysis.file_name || 'Análise sem nome'}
                            </p>
                            <div className="flex-shrink-0">
                              <p className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5 ${progressPercent === 100 ? 'bg-emerald-950/40 text-emerald-300' : 'bg-cyan-950/50 text-cyan-200'}`}>
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
                              <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                                <User className="h-3 w-3" />
                                <span>{analysis.created_by_email || 'Usuário'}</span>
                              </div>
                            </div>
                            <div className="mt-2 flex items-center text-sm text-slate-400 sm:mt-0">
                              <p>{completedItems} de {totalItems} itens verificados</p>
                            </div>
                          </div>

                          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                            <div className={`h-1.5 rounded-full transition-all duration-500 ${progressPercent === 100 ? 'bg-emerald-500' : 'bg-cyan-500'}`} style={{ width: `${progressPercent}%` }}></div>
                          </div>
                        </Link>

                        <button
                          type="button"
                          onClick={() => handleDeleteAnalysis(analysis.id)}
                          disabled={deletingAnalysisId === analysis.id}
                          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-red-900/60 bg-red-950/30 text-red-300 transition hover:bg-red-950/50 disabled:opacity-50"
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

        {hasMoreRemote && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800 disabled:opacity-50"
            >
              {loadingMore ? 'Carregando...' : 'Carregar mais'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
