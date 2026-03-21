import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { supabase } from '../lib/supabase';
import { AnalysisItem } from '../types';
import { db } from '../lib/db';
import { queueMutation } from '../lib/sync';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { AnalysisPDF } from '../components/AnalysisPDF';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { Header } from '../components/Header';
import { OfflineIndicator } from '../components/OfflineIndicator';
import { RealtimeStatusIndicator } from '../components/RealtimeStatusIndicator';
import { Search, X, Plus, Edit2, CheckCircle, AlertTriangle, Clock, FileDown } from 'lucide-react';
import { addDebugLog } from '../lib/debug';

export function sortAnalysisItems<T extends Pick<AnalysisItem, 'status' | 'created_at'>>(items: T[]) {
  const statusPriority = { Pendente: 0, OK: 1, Divergência: 2 } as const;

  return [...items].sort((a, b) => {
    const priorityDiff = statusPriority[a.status as keyof typeof statusPriority] - statusPriority[b.status as keyof typeof statusPriority];

    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export default function AnalysisDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { status: realtimeStatus } = useRealtimeSync(id);

  const analysis = useLiveQuery(() => id ? db.analyses.get(id) : undefined, [id]);
  const items = useLiveQuery(() => id ? db.analysis_items.where('analysis_id').equals(id).reverse().sortBy('created_at') : [], [id]) || [];
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tag, setTag] = useState('');
  const [descricao, setDescricao] = useState('');
  const [modelo, setModelo] = useState('');
  const [patrimonio, setPatrimonio] = useState('');
  const [numeroSerie, setNumeroSerie] = useState('');
  const [status, setStatus] = useState('Pendente');
  const [adding, setAdding] = useState(false);

  // Notes state
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Edit state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AnalysisItem>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (analysis && !notes) {
      setNotes(analysis.notes || '');
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

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tag.trim() || !id) return;
    
    setAdding(true);
    try {
      const itemId = crypto.randomUUID();
      const now = new Date().toISOString();
      const newItem = {
        id: itemId,
        analysis_id: id,
        tag,
        descricao: descricao || 'N/A',
        modelo: modelo || 'N/A',
        patrimonio: patrimonio || 'N/A',
        numero_serie: numeroSerie || 'N/A',
        status,
        created_at: now,
        updated_at: now
      };
      
      await queueMutation('INSERT', 'analysis_items', itemId, newItem);
      
      setTag('');
      setDescricao('');
      setModelo('');
      setPatrimonio('');
      setNumeroSerie('');
      setStatus('Pendente');
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Erro ao adicionar item.');
    } finally {
      setAdding(false);
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
      alert('Erro ao atualizar status.');
    }
  };

  const handleSaveNotes = async () => {
    if (!id || !analysis) return;
    setSavingNotes(true);
    try {
      const updatedAnalysis = { ...analysis, notes, updated_at: new Date().toISOString() };
      await queueMutation('UPDATE', 'analyses', id, updatedAnalysis);
    } catch (error) {
      console.error('Error saving notes:', error);
      alert('Erro ao salvar notas.');
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
      alert('Erro ao atualizar item.');
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  if (!analysis) {
    return <div className="min-h-screen flex items-center justify-center">Análise não encontrada.</div>;
  }

  const filteredItems = sortAnalysisItems(items.filter(item => {
    const q = searchQuery.toLowerCase();
    return (
      item.tag.toLowerCase().includes(q) ||
      item.descricao.toLowerCase().includes(q) ||
      item.patrimonio.toLowerCase().includes(q) ||
      item.numero_serie.toLowerCase().includes(q)
    );
  }));

  const totalItems = items.length;
  const completedItems = items.filter(i => i.status !== 'Pendente').length;
  const progressPercent = totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);

  return (
    <div className="min-h-screen bg-slate-50 pb-24 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <OfflineIndicator />
      <Header title={analysis.file_name}>
        <RealtimeStatusIndicator status={realtimeStatus} />
        <PDFDownloadLink
          document={<AnalysisPDF analysis={analysis} items={items} />}
          fileName={`relatorio-${analysis.id}.pdf`}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 min-h-[44px]"
        >
          {({ loading }) => (
            <>
              <FileDown className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">{loading ? 'Gerando...' : 'Exportar PDF'}</span>
              <span className="sm:hidden">PDF</span>
            </>
          )}
        </PDFDownloadLink>
      </Header>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Progress and Summary */}
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Progresso da Análise</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{completedItems} de {totalItems} itens verificados</p>
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
              <Search className="h-5 w-5 text-slate-400 dark:text-slate-500" />
            </div>
            <input
              type="text"
              placeholder="Buscar por tag, descrição, patrimônio ou nº série..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-10 leading-5 text-slate-900 placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none focus:placeholder-slate-400 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 sm:py-2 sm:text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 flex min-w-[44px] items-center justify-center pr-3 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {filteredItems.length} resultado{filteredItems.length !== 1 ? 's' : ''} encontrado{filteredItems.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Notes */}
          <div className="lg:col-span-1 order-2 lg:order-1">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900 sm:p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Notas Gerais</h2>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="block w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 sm:text-sm"
                placeholder="Observações gerais sobre esta análise..."
              />
              <button
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="mt-4 flex min-h-[44px] w-full justify-center rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800 sm:py-2"
              >
                {savingNotes ? 'Salvando...' : 'Salvar Notas'}
              </button>
            </div>
          </div>

          {/* List of items */}
          <div className="lg:col-span-2 order-1 lg:order-2">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/80 sm:px-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Itens da Análise</h3>
              </div>
              
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                  <thead className="bg-slate-50 dark:bg-slate-900/80">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Tag</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Descrição</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                          {searchQuery ? 'Nenhum item encontrado para a busca.' : 'Nenhum item adicionado ainda.'}
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item) => (
                        <tr key={item.id} className={item.status === 'Pendente' ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/40'}>
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
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-100">
                                <div className="flex items-center">
                                  {item.tag}
                                  <button onClick={() => startEditing(item)} className="ml-2 p-1 text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-cyan-300" title="Editar">
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                                {item.descricao}
                                {(item.modelo !== 'N/A' || item.patrimonio !== 'N/A') && (
                                  <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                    Mod: {item.modelo} | Pat: {item.patrimonio}
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
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handleUpdateStatus(item.id, 'OK')}
                                    className="rounded-lg p-2 text-emerald-600 transition-colors hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                                    title="Marcar como OK"
                                  >
                                    <CheckCircle className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => handleUpdateStatus(item.id, 'Divergência')}
                                    className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30"
                                    title="Marcar Divergência"
                                  >
                                    <AlertTriangle className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => handleUpdateStatus(item.id, 'Pendente')}
                                    className="rounded-lg p-2 text-amber-600 transition-colors hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30"
                                    title="Marcar como Pendente"
                                  >
                                    <Clock className="w-5 h-5" />
                                  </button>
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
                  <div className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                    {searchQuery ? 'Nenhum item encontrado para a busca.' : 'Nenhum item adicionado ainda.'}
                  </div>
                ) : (
                  filteredItems.map((item) => (
                    <div key={item.id} className={`p-4 ${item.status === 'Pendente' ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/40'}`}>
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
                              <span className="text-base font-bold text-slate-900 dark:text-slate-100">{item.tag}</span>
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
                          <p className="mb-2 text-sm text-slate-700 dark:text-slate-300">{item.descricao}</p>
                          <div className="mb-4 grid grid-cols-2 gap-2 rounded border border-slate-100 bg-white p-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                            <div><span className="font-medium">Mod:</span> {item.modelo}</div>
                            <div><span className="font-medium">Pat:</span> {item.patrimonio}</div>
                            <div className="col-span-2"><span className="font-medium">NS:</span> {item.numero_serie}</div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateStatus(item.id, 'OK')}
                              className="flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                            >
                              <CheckCircle className="w-4 h-4" /> OK
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(item.id, 'Divergência')}
                              className="flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
                            >
                              <AlertTriangle className="w-4 h-4" /> Diverg.
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(item.id, 'Pendente')}
                              className="flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50"
                            >
                              <Clock className="w-4 h-4" /> Pend.
                            </button>
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

      {/* Floating Action Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform hover:scale-105 z-40"
        aria-label="Adicionar Item"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Add Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-950/70 transition-opacity" aria-hidden="true" onClick={() => setIsModalOpen(false)}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block w-full transform overflow-hidden rounded-t-2xl bg-white text-left shadow-xl transition-all dark:bg-slate-900 sm:my-8 sm:max-w-lg sm:align-middle sm:rounded-2xl">
              <div className="bg-white px-4 pt-5 pb-4 dark:bg-slate-900 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-lg leading-6 font-bold text-slate-900 dark:text-slate-100" id="modal-title">
                    Adicionar Novo Item
                  </h3>
                  <button onClick={() => setIsModalOpen(false)} className="flex min-h-[44px] min-w-[44px] items-center justify-center p-2 text-slate-400 hover:text-slate-500 dark:text-slate-500 dark:hover:text-slate-300">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <form id="add-item-form" onSubmit={handleAddItem} className="space-y-4">
                  <div>
                    <label htmlFor="tag" className="block text-sm font-medium text-slate-700 dark:text-slate-200">Tag *</label>
                    <input
                      type="text"
                      id="tag"
                      value={tag}
                      onChange={(e) => setTag(e.target.value)}
                      required
                      className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 sm:text-sm"
                      placeholder="Ex: EXT-01"
                    />
                  </div>
                  <div>
                    <label htmlFor="descricao" className="block text-sm font-medium text-slate-700">Descrição</label>
                    <input
                      type="text"
                      id="descricao"
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 sm:text-sm"
                      placeholder="Ex: Extintor de Incêndio"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="modelo" className="block text-sm font-medium text-slate-700">Modelo</label>
                      <input
                        type="text"
                        id="modelo"
                        value={modelo}
                        onChange={(e) => setModelo(e.target.value)}
                        className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="patrimonio" className="block text-sm font-medium text-slate-700">Patrimônio</label>
                      <input
                        type="text"
                        id="patrimonio"
                        value={patrimonio}
                        onChange={(e) => setPatrimonio(e.target.value)}
                        className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 sm:text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="numeroSerie" className="block text-sm font-medium text-slate-700">Número de Série</label>
                    <input
                      type="text"
                      id="numeroSerie"
                      value={numeroSerie}
                      onChange={(e) => setNumeroSerie(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="status" className="block text-sm font-medium text-slate-700">Status Inicial</label>
                    <select
                      id="status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="mt-1 block w-full bg-white border border-slate-300 rounded-lg shadow-sm py-3 px-4 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    >
                      <option value="Pendente">Pendente</option>
                      <option value="OK">OK</option>
                      <option value="Divergência">Divergência</option>
                    </select>
                  </div>
                </form>
              </div>
              <div className="flex flex-col gap-3 bg-slate-50 px-4 py-4 dark:bg-slate-950/80 sm:flex-row-reverse sm:px-6">
                <button
                  type="submit"
                  form="add-item-form"
                  disabled={adding}
                  className="flex min-h-[44px] w-full justify-center rounded-lg border border-transparent bg-indigo-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400 sm:w-auto sm:py-2 sm:text-sm"
                >
                  {adding ? 'Salvando...' : 'Salvar Item'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex min-h-[44px] w-full justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 sm:w-auto sm:py-2 sm:text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
