export interface Analysis {
  id: string;
  user_id: string;
  file_name: string;
  created_at: string;
  updated_at: string;
}

export interface AnalysisItem {
  id: string;
  analysis_id: string;
  tag: string;
  descricao: string;
  modelo: string;
  patrimonio: string;
  numero_serie: string;
  status: string;
  created_at: string;
  updated_at: string;
}
