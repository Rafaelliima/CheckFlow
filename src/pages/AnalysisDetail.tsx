import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Analysis, AnalysisItem } from '../types';

export default function AnalysisDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [items, setItems] = useState<AnalysisItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [tag, setTag] = useState('');
  const [descricao, setDescricao] = useState('');
  const [modelo, setModelo] = useState('');
  const [patrimonio, setPatrimonio] = useState('');
  const [numeroSerie, setNumeroSerie] = useState('');
  const [status, setStatus] = useState('Pendente');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchAnalysisAndItems();
  }, [id]);

  const fetchAnalysisAndItems = async () => {
    if (!id) return;
    
    try {
      // Fetch Analysis
      const { data: analysisData, error: analysisError } = await supabase
        .from('analyses')
        .select('*')
        .eq('id', id)
        .single();
        
      if (analysisError) throw analysisError;
      setAnalysis(analysisData);

      // Fetch Items
      const { data: itemsData, error: itemsError } = await supabase
        .from('analysis_items')
        .select('*')
        .eq('analysis_id', id)
        .order('created_at', { ascending: false });
        
      if (itemsError) throw itemsError;
      setItems(itemsData || []);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Erro ao carregar a análise.');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tag.trim() || !id) return;
    
    setAdding(true);
    try {
      const { data, error } = await supabase
        .from('analysis_items')
        .insert([
          { 
            analysis_id: id, 
            tag, 
            descricao: descricao || 'N/A', 
            modelo: modelo || 'N/A', 
            patrimonio: patrimonio || 'N/A', 
            numero_serie: numeroSerie || 'N/A', 
            status 
          }
        ])
        .select()
        .single();
        
      if (error) throw error;
      
      setItems([data, ...items]);
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
      const { error } = await supabase
        .from('analysis_items')
        .update({ status: newStatus })
        .eq('id', itemId);
        
      if (error) throw error;
      
      setItems(items.map(item => item.id === itemId ? { ...item, status: newStatus } : item));
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Erro ao atualizar status.');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  if (!analysis) {
    return <div className="min-h-screen flex items-center justify-center">Análise não encontrada.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/dashboard" className="text-indigo-600 hover:text-indigo-900 font-medium mr-4">
                &larr; Voltar
              </Link>
              <h1 className="text-xl font-bold text-gray-900">{analysis.file_name}</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Form to add item */}
          <div className="md:col-span-1">
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
                        <tr key={item.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.tag}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{item.descricao}</td>
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
