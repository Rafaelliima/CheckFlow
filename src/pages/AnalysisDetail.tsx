import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { supabase } from '../lib/supabase';
import { AnalysisItem } from '../types';
import { db } from '../lib/db';
import { queueMutation } from '../lib/sync';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { AnalysisPDF } from '../components/AnalysisPDF';

export default function AnalysisDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const analysis = useLiveQuery(() => id ? db.analyses.get(id) : undefined, [id]);
  const items = useLiveQuery(() => id ? db.analysis_items.where('analysis_id').equals(id).reverse().sortBy('created_at') : [], [id]) || [];
  
  const [loading, setLoading] = useState(true);
  
  // Form state
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
    // We assume data is pulled globally in Dashboard, but we could also pull here
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

  const totalItems = items.length;
  const completedItems = items.filter(i => i.status !== 'Pendente').length;
  const progressPercent = totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <Link to="/dashboard" className="text-indigo-600 hover:text-indigo-900 font-medium mr-4">
                &larr; Voltar
              </Link>
              <h1 className="text-xl font-bold text-gray-900">{analysis.file_name}</h1>
            </div>
            <div>
              <PDFDownloadLink
                document={<AnalysisPDF analysis={analysis} items={items} />}
                fileName={`relatorio-${analysis.id}.pdf`}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {({ loading }) => (loading ? 'Gerando PDF...' : 'Exportar PDF')}
              </PDFDownloadLink>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Progress and Summary */}
        <div className="px-4 sm:px-0 mb-6">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-4">
              <div>
                <h2 className="text-lg font-medium text-gray-900">Progresso da Análise</h2>
                <p className="text-sm text-gray-500">{completedItems} de {totalItems} itens verificados</p>
              </div>
              <div className="mt-4 md:mt-0 text-right">
                <span className="text-2xl font-bold text-indigo-600">{progressPercent}%</span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-0 grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Form to add item & Notes */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Notas Gerais</h2>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Observações gerais sobre esta análise..."
              />
              <button
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="mt-3 w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {savingNotes ? 'Salvando...' : 'Salvar Notas'}
              </button>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Adicionar Item</h2>
              <form onSubmit={handleAddItem} className="space-y-4">
                <div>
                  <label htmlFor="tag" className="block text-sm font-medium text-gray-700">Tag</label>
                  <input
                    type="text"
                    id="tag"
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Ex: EXT-01"
                  />
                </div>
                <div>
                  <label htmlFor="descricao" className="block text-sm font-medium text-gray-700">Descrição</label>
                  <input
                    type="text"
                    id="descricao"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Ex: Extintor de Incêndio"
                  />
                </div>
                <div>
                  <label htmlFor="modelo" className="block text-sm font-medium text-gray-700">Modelo</label>
                  <input
                    type="text"
                    id="modelo"
                    value={modelo}
                    onChange={(e) => setModelo(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="patrimonio" className="block text-sm font-medium text-gray-700">Patrimônio</label>
                  <input
                    type="text"
                    id="patrimonio"
                    value={patrimonio}
                    onChange={(e) => setPatrimonio(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="numeroSerie" className="block text-sm font-medium text-gray-700">Número de Série</label>
                  <input
                    type="text"
                    id="numeroSerie"
                    value={numeroSerie}
                    onChange={(e) => setNumeroSerie(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
                  <select
                    id="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="mt-1 block w-full bg-white border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="Pendente">Pendente</option>
                    <option value="OK">OK</option>
                    <option value="Divergência">Divergência</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={adding}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {adding ? 'Adicionando...' : 'Adicionar'}
                </button>
              </form>
            </div>
          </div>

          {/* List of items */}
          <div className="md:col-span-2">
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Itens da Análise</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tag</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                          Nenhum item adicionado ainda.
                        </td>
                      </tr>
                    ) : (
                      items.map((item) => (
                        <tr key={item.id} className={item.status === 'Pendente' ? 'bg-white' : 'bg-gray-50'}>
                          {editingItemId === item.id ? (
                            <td colSpan={4} className="px-6 py-4">
                              <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                  <label className="block text-xs font-medium text-gray-700">Tag</label>
                                  <input type="text" value={editForm.tag || ''} onChange={e => setEditForm({...editForm, tag: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700">Descrição</label>
                                  <input type="text" value={editForm.descricao || ''} onChange={e => setEditForm({...editForm, descricao: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700">Modelo</label>
                                  <input type="text" value={editForm.modelo || ''} onChange={e => setEditForm({...editForm, modelo: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700">Patrimônio</label>
                                  <input type="text" value={editForm.patrimonio || ''} onChange={e => setEditForm({...editForm, patrimonio: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700">Nº Série</label>
                                  <input type="text" value={editForm.numero_serie || ''} onChange={e => setEditForm({...editForm, numero_serie: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm" />
                                </div>
                              </div>
                              <div className="flex space-x-2">
                                <button onClick={handleSaveEdit} disabled={savingEdit} className="px-3 py-1 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 disabled:opacity-50">
                                  {savingEdit ? 'Salvando...' : 'Salvar'}
                                </button>
                                <button onClick={() => setEditingItemId(null)} disabled={savingEdit} className="px-3 py-1 bg-gray-200 text-gray-700 text-xs font-medium rounded hover:bg-gray-300">
                                  Cancelar
                                </button>
                              </div>
                            </td>
                          ) : (
                            <>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {item.tag}
                                <button onClick={() => startEditing(item)} className="ml-2 text-gray-400 hover:text-indigo-600" title="Editar">
                                  ✎
                                </button>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {item.descricao}
                                {(item.modelo !== 'N/A' || item.patrimonio !== 'N/A') && (
                                  <div className="text-xs text-gray-400 mt-1">
                                    Mod: {item.modelo} | Pat: {item.patrimonio}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                  ${item.status === 'OK' ? 'bg-green-100 text-green-800' : 
                                    item.status === 'Divergência' ? 'bg-red-100 text-red-800' : 
                                    'bg-yellow-100 text-yellow-800'}`}>
                                  {item.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                <button
                                  onClick={() => handleUpdateStatus(item.id, 'OK')}
                                  className="text-green-600 hover:text-green-900"
                                >
                                  OK
                                </button>
                                <button
                                  onClick={() => handleUpdateStatus(item.id, 'Divergência')}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Divergência
                                </button>
                                <button
                                  onClick={() => handleUpdateStatus(item.id, 'Pendente')}
                                  className="text-yellow-600 hover:text-yellow-900"
                                >
                                  Pendente
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
