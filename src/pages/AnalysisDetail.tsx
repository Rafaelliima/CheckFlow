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
import { Search, X, Plus, Edit2, CheckCircle, AlertTriangle, Clock, FileDown } from 'lucide-react';

export default function AnalysisDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  useRealtimeSync(id);

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

  const filteredItems = items.filter(item => {
    const q = searchQuery.toLowerCase();
    return (
      item.tag.toLowerCase().includes(q) ||
      item.descricao.toLowerCase().includes(q) ||
      item.patrimonio.toLowerCase().includes(q) ||
      item.numero_serie.toLowerCase().includes(q)
    );
  });

  const totalItems = items.length;
  const completedItems = items.filter(i => i.status !== 'Pendente').length;
  const progressPercent = totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <OfflineIndicator />
      <Header title={analysis.file_name}>
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
        <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Progresso da Análise</h2>
              <p className="text-sm text-slate-500">{completedItems} de {totalItems} itens verificados</p>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-3xl font-bold text-indigo-600">{progressPercent}%</span>
            </div>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div className={`h-3 rounded-full transition-all duration-500 ${progressPercent === 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`} style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar por tag, descrição, patrimônio ou nº série..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-10 py-3 sm:py-2 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 min-w-[44px] justify-center"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="mt-2 text-sm text-slate-500">
              {filteredItems.length} resultado{filteredItems.length !== 1 ? 's' : ''} encontrado{filteredItems.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Notes */}
          <div className="lg:col-span-1 order-2 lg:order-1">
            <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Notas Gerais</h2>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="block w-full border border-slate-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm resize-none"
                placeholder="Observações gerais sobre esta análise..."
              />
              <button
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="mt-4 w-full flex justify-center py-3 sm:py-2 px-4 border border-slate-300 rounded-lg shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 min-h-[44px]"
              >
                {savingNotes ? 'Salvando...' : 'Salvar Notas'}
              </button>
            </div>
          </div>

          {/* List of items */}
          <div className="lg:col-span-2 order-1 lg:order-2">
            <div className="bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-4 sm:px-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-slate-900">Itens da Análise</h3>
              </div>
              
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tag</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Descrição</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                          {searchQuery ? 'Nenhum item encontrado para a busca.' : 'Nenhum item adicionado ainda.'}
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item) => (
                        <tr key={item.id} className={item.status === 'Pendente' ? 'bg-white' : 'bg-slate-50'}>
                          {editingItemId === item.id ? (
                            <td colSpan={4} className="px-6 py-4">
                              <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                  <label className="block text-xs font-medium text-slate-700">Tag</label>
                                  <input type="text" value={editForm.tag || ''} onChange={e => setEditForm({...editForm, tag: e.target.value})} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-1 px-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-slate-700">Descrição</label>
                                  <input type="text" value={editForm.descricao || ''} onChange={e => setEditForm({...editForm, descricao: e.target.value})} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-1 px-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-slate-700">Modelo</label>
                                  <input type="text" value={editForm.modelo || ''} onChange={e => setEditForm({...editForm, modelo: e.target.value})} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-1 px-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-slate-700">Patrimônio</label>
                                  <input type="text" value={editForm.patrimonio || ''} onChange={e => setEditForm({...editForm, patrimonio: e.target.value})} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-1 px-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-slate-700">Nº Série</label>
                                  <input type="text" value={editForm.numero_serie || ''} onChange={e => setEditForm({...editForm, numero_serie: e.target.value})} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-1 px-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                                </div>
                              </div>
                              <div className="flex space-x-2">
                                <button onClick={handleSaveEdit} disabled={savingEdit} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 min-h-[44px]">
                                  {savingEdit ? 'Salvando...' : 'Salvar'}
                                </button>
                                <button onClick={() => setEditingItemId(null)} disabled={savingEdit} className="px-4 py-2 bg-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-300 min-h-[44px]">
                                  Cancelar
                                </button>
                              </div>
                            </td>
                          ) : (
                            <>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                                <div className="flex items-center">
                                  {item.tag}
                                  <button onClick={() => startEditing(item)} className="ml-2 text-slate-400 hover:text-indigo-600 p-1" title="Editar">
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-500">
                                {item.descricao}
                                {(item.modelo !== 'N/A' || item.patrimonio !== 'N/A') && (
                                  <div className="text-xs text-slate-400 mt-1">
                                    Mod: {item.modelo} | Pat: {item.patrimonio}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                                  ${item.status === 'OK' ? 'bg-emerald-100 text-emerald-800' : 
                                    item.status === 'Divergência' ? 'bg-red-100 text-red-800' : 
                                    'bg-amber-100 text-amber-800'}`}>
                                  {item.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handleUpdateStatus(item.id, 'OK')}
                                    className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                    title="Marcar como OK"
                                  >
                                    <CheckCircle className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => handleUpdateStatus(item.id, 'Divergência')}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Marcar Divergência"
                                  >
                                    <AlertTriangle className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => handleUpdateStatus(item.id, 'Pendente')}
                                    className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
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
              <div className="md:hidden divide-y divide-slate-200">
                {filteredItems.length === 0 ? (
                  <div className="px-4 py-12 text-center text-slate-500">
                    {searchQuery ? 'Nenhum item encontrado para a busca.' : 'Nenhum item adicionado ainda.'}
                  </div>
                ) : (
                  filteredItems.map((item) => (
                    <div key={item.id} className={`p-4 ${item.status === 'Pendente' ? 'bg-white' : 'bg-slate-50'}`}>
                      {editingItemId === item.id ? (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-medium text-slate-700">Tag</label>
                            <input type="text" value={editForm.tag || ''} onChange={e => setEditForm({...editForm, tag: e.target.value})} className="mt-1 block w-full border border-slate-300 rounded-lg shadow-sm py-2 px-3 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700">Descrição</label>
                            <input type="text" value={editForm.descricao || ''} onChange={e => setEditForm({...editForm, descricao: e.target.value})} className="mt-1 block w-full border border-slate-300 rounded-lg shadow-sm py-2 px-3 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-slate-700">Modelo</label>
                              <input type="text" value={editForm.modelo || ''} onChange={e => setEditForm({...editForm, modelo: e.target.value})} className="mt-1 block w-full border border-slate-300 rounded-lg shadow-sm py-2 px-3 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-700">Patrimônio</label>
                              <input type="text" value={editForm.patrimonio || ''} onChange={e => setEditForm({...editForm, patrimonio: e.target.value})} className="mt-1 block w-full border border-slate-300 rounded-lg shadow-sm py-2 px-3 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700">Nº Série</label>
                            <input type="text" value={editForm.numero_serie || ''} onChange={e => setEditForm({...editForm, numero_serie: e.target.value})} className="mt-1 block w-full border border-slate-300 rounded-lg shadow-sm py-2 px-3 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                          </div>
                          <div className="flex space-x-3 pt-2">
                            <button onClick={handleSaveEdit} disabled={savingEdit} className="flex-1 py-3 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 min-h-[44px]">
                              {savingEdit ? 'Salvando...' : 'Salvar'}
                            </button>
                            <button onClick={() => setEditingItemId(null)} disabled={savingEdit} className="flex-1 py-3 bg-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-300 min-h-[44px]">
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-base font-bold text-slate-900">{item.tag}</span>
                              <button onClick={() => startEditing(item)} className="text-slate-400 hover:text-indigo-600 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center" title="Editar">
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
                          <p className="text-sm text-slate-700 mb-2">{item.descricao}</p>
                          <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 mb-4 bg-white p-2 rounded border border-slate-100">
                            <div><span className="font-medium">Mod:</span> {item.modelo}</div>
                            <div><span className="font-medium">Pat:</span> {item.patrimonio}</div>
                            <div className="col-span-2"><span className="font-medium">NS:</span> {item.numero_serie}</div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateStatus(item.id, 'OK')}
                              className="flex-1 flex items-center justify-center gap-1 py-2 px-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 min-h-[44px] text-sm font-medium"
                            >
                              <CheckCircle className="w-4 h-4" /> OK
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(item.id, 'Divergência')}
                              className="flex-1 flex items-center justify-center gap-1 py-2 px-3 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 min-h-[44px] text-sm font-medium"
                            >
                              <AlertTriangle className="w-4 h-4" /> Diverg.
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(item.id, 'Pendente')}
                              className="flex-1 flex items-center justify-center gap-1 py-2 px-3 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 min-h-[44px] text-sm font-medium"
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
            <div className="fixed inset-0 bg-slate-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setIsModalOpen(false)}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-t-2xl sm:rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-lg leading-6 font-bold text-slate-900" id="modal-title">
                    Adicionar Novo Item
                  </h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-500 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <form id="add-item-form" onSubmit={handleAddItem} className="space-y-4">
                  <div>
                    <label htmlFor="tag" className="block text-sm font-medium text-slate-700">Tag *</label>
                    <input
                      type="text"
                      id="tag"
                      value={tag}
                      onChange={(e) => setTag(e.target.value)}
                      required
                      className="mt-1 block w-full border border-slate-300 rounded-lg shadow-sm py-3 px-4 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
                      className="mt-1 block w-full border border-slate-300 rounded-lg shadow-sm py-3 px-4 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
                        className="mt-1 block w-full border border-slate-300 rounded-lg shadow-sm py-3 px-4 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="patrimonio" className="block text-sm font-medium text-slate-700">Patrimônio</label>
                      <input
                        type="text"
                        id="patrimonio"
                        value={patrimonio}
                        onChange={(e) => setPatrimonio(e.target.value)}
                        className="mt-1 block w-full border border-slate-300 rounded-lg shadow-sm py-3 px-4 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
                      className="mt-1 block w-full border border-slate-300 rounded-lg shadow-sm py-3 px-4 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
              <div className="bg-slate-50 px-4 py-4 sm:px-6 flex flex-col sm:flex-row-reverse gap-3">
                <button
                  type="submit"
                  form="add-item-form"
                  disabled={adding}
                  className="w-full sm:w-auto flex justify-center py-3 sm:py-2 px-6 border border-transparent rounded-lg shadow-sm text-base sm:text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 min-h-[44px]"
                >
                  {adding ? 'Salvando...' : 'Salvar Item'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-full sm:w-auto flex justify-center py-3 sm:py-2 px-6 border border-slate-300 rounded-lg shadow-sm text-base sm:text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 min-h-[44px]"
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
