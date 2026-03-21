export interface Analysis {
  id: string;
  user_id: string;
  created_by?: string;
  created_by_email?: string;
  file_name: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  analysis_items?: { id: string; status: string }[];
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
