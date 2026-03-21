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
import { Clock, Plus, Upload, User } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [uploadStep, setUploadStep] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<any>(null);
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
      await pullData(session.user.id);
      setLoading(false);
    };
    
    checkUserAndFetchData();
  }, [navigate]);

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
          const newItem = {
            id: itemId,
            analysis_id: analysisId,
            tag: item.tag || 'N/A',
            descricao: item.descricao || 'N/A',
            modelo: item.modelo || 'N/A',
            patrimonio: item.patrimonio || 'N/A',
            numero_serie: item.numero_serie || 'N/A',
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

  const handleCreateAnalysis = async () => {
    if (!user) return;
    setCreating(true);
    
    const analysisId = crypto.randomUUID();
    const fileName = `Análise Manual - ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`;
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
    
    try {
      await queueMutation('INSERT', 'analyses', analysisId, newAnalysis);
      navigate(`/analysis/${analysisId}`);
    } catch (error) {
      console.error('Error creating analysis:', error);
      alert('Erro ao criar nova análise.');
      setCreating(false);
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
    <div className="min-h-screen bg-slate-50 pb-20 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100 sm:pb-0">
      <OfflineIndicator />
      <Header title="CheckFlow Dashboard" />

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-100">Minhas Análises</h2>
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Buscar análise..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base shadow-sm transition-colors focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 sm:w-64 sm:py-2 sm:text-sm"
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
                disabled={!!uploadStep || creating}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 sm:flex-none sm:py-2"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {uploadStep === 'pdf' ? 'Lendo...' : 
                   uploadStep === 'ai' ? 'Analisando...' : 
                   uploadStep === 'saving' ? 'Salvando...' : 'Upload PDF'}
                </span>
                <span className="sm:hidden">PDF</span>
              </button>
              <button
                onClick={handleCreateAnalysis}
                disabled={creating || !!uploadStep}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-transparent bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400 sm:flex-none sm:py-2"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">{creating ? 'Criando...' : 'Nova Análise'}</span>
                <span className="sm:hidden">Nova</span>
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredAnalyses.length === 0 ? (
              <li className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                Nenhuma análise encontrada.
              </li>
            ) : (
              filteredAnalyses.map((analysis) => {
                const totalItems = analysis.analysis_items?.length || 0;
                const completedItems = analysis.analysis_items?.filter(i => i.status !== 'Pendente').length || 0;
                const progressPercent = totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);

                return (
                  <li key={analysis.id}>
                    <Link to={`/analysis/${analysis.id}`} className="block transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60">
                      <div className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between mb-2">
                          <p className="truncate pr-4 text-base font-medium text-indigo-600 dark:text-cyan-300">
                            {analysis.file_name || 'Análise sem nome'}
                          </p>
                          <div className="flex-shrink-0">
                            <p className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5 ${progressPercent === 100 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200'}`}>
                              {progressPercent}%
                            </p>
                          </div>
                        </div>
                        <div className="sm:flex sm:justify-between">
                          <div className="sm:flex flex-col gap-1">
                            <p className="flex items-center text-sm text-slate-500 dark:text-slate-400">
                              <Clock className="mr-1.5 h-4 w-4 flex-shrink-0 text-slate-400 dark:text-slate-500" />
                              {new Date(analysis.created_at).toLocaleDateString('pt-BR')} às {new Date(analysis.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <div className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                              <User className="w-3 h-3" />
                              <span>{analysis.created_by_email || 'Usuário'}</span>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center text-sm text-slate-500 dark:text-slate-400 sm:mt-0">
                            <p>
                              {completedItems} de {totalItems} itens verificados
                            </p>
                          </div>
                        </div>
                        {/* Progress Bar */}
                        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div className={`h-1.5 rounded-full transition-all duration-500 ${progressPercent === 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`} style={{ width: `${progressPercent}%` }}></div>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </main>
    </div>
  );
}
