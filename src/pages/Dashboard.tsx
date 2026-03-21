import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Analysis } from '../types';
import { extractTextFromPDF } from '../lib/pdf';
import { extractEquipmentFromText } from '../lib/gemini';

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkUserAndFetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/');
        return;
      }
      
      setUser(session.user);
      await fetchAnalyses();
      setLoading(false);
    };
    
    checkUserAndFetchData();
  }, [navigate]);

  const fetchAnalyses = async () => {
    const { data, error } = await supabase
      .from('analyses')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching analyses:', error);
    } else {
      setAnalyses(data || []);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setUploading(true);
    try {
      // 1. Extract text
      const text = await extractTextFromPDF(file);
      
      // 2. Send to Gemini
      const items = await extractEquipmentFromText(text);
      
      // 3. Create Analysis
      const fileName = `Análise PDF - ${file.name}`;
      const { data: analysis, error: analysisError } = await supabase
        .from('analyses')
        .insert([{ user_id: user.id, file_name: fileName }])
        .select()
        .single();
        
      if (analysisError) throw analysisError;
      
      // 4. Insert Items
      if (items.length > 0) {
        const itemsToInsert = items.map((item: any) => ({
          analysis_id: analysis.id,
          tag: item.tag || 'N/A',
          descricao: item.descricao || 'N/A',
          modelo: item.modelo || 'N/A',
          patrimonio: item.patrimonio || 'N/A',
          numero_serie: item.numero_serie || 'N/A',
          status: 'Pendente'
        }));
        
        const { error: itemsError } = await supabase
          .from('analysis_items')
          .insert(itemsToInsert);
          
        if (itemsError) throw itemsError;
      }
      
      // 5. Redirect
      navigate(`/analysis/${analysis.id}`);
    } catch (error) {
      console.error('Error processing PDF:', error);
      alert('Erro ao processar o PDF.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateAnalysis = async () => {
    if (!user) return;
    setCreating(true);
    
    const fileName = `Análise Manual - ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`;
    
    try {
      const { data, error } = await supabase
        .from('analyses')
        .insert([
          { user_id: user.id, file_name: fileName }
        ])
        .select()
        .single();
        
      if (error) throw error;
      
      // Navigate to the new analysis detail page
      navigate(`/analysis/${data.id}`);
    } catch (error) {
      console.error('Error creating analysis:', error);
      alert('Erro ao criar nova análise.');
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">RondaAI Dashboard</h1>
            </div>
            <div className="flex items-center">
              <button
                onClick={handleLogout}
                className="ml-4 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-900">Minhas Análises</h2>
            <div className="flex space-x-4">
              <input 
                type="file" 
                accept="application/pdf" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || creating}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {uploading ? 'Processando PDF...' : 'Upload PDF'}
              </button>
              <button
                onClick={handleCreateAnalysis}
                disabled={creating || uploading}
                className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {creating ? 'Criando...' : 'Nova Análise Manual'}
              </button>
            </div>
          </div>

          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {analyses.length === 0 ? (
                <li className="px-4 py-12 text-center text-gray-500">
                  Nenhuma análise encontrada. Clique em "Nova Análise" para começar.
                </li>
              ) : (
                analyses.map((analysis) => (
                  <li key={analysis.id}>
                    <Link to={`/analysis/${analysis.id}`} className="block hover:bg-gray-50">
                      <div className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-indigo-600 truncate">
                            {analysis.file_name}
                          </p>
                          <div className="ml-2 flex-shrink-0 flex">
                            <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Ativa
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 sm:flex sm:justify-between">
                          <div className="sm:flex">
                            <p className="flex items-center text-sm text-gray-500">
                              Criada em {new Date(analysis.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
