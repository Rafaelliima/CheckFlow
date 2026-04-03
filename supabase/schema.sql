-- Create analyses table
CREATE TABLE analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_by_email TEXT,
  file_name TEXT NOT NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create analysis_items table
CREATE TABLE analysis_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID REFERENCES analyses(id) ON DELETE CASCADE NOT NULL,
  tag TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT 'N/A',
  modelo TEXT NOT NULL DEFAULT 'N/A',
  patrimonio TEXT NOT NULL DEFAULT 'N/A',
  numero_serie TEXT NOT NULL DEFAULT 'N/A',
  status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for analyses
-- Modelo colaborativo:
-- Leitura é permitida para qualquer usuário autenticado.
-- Escrita/atualização/exclusão continuam restritas ao dono (user_id).
CREATE POLICY "Authenticated users can view all analyses" ON analyses
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert their own analyses" ON analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own analyses" ON analyses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own analyses" ON analyses
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for analysis_items
CREATE POLICY "Authenticated users can view all items" ON analysis_items
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert items to their analyses" ON analysis_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM analyses
      WHERE analyses.id = analysis_items.analysis_id
      AND analyses.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update items of their analyses" ON analysis_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM analyses
      WHERE analyses.id = analysis_items.analysis_id
      AND analyses.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete items of their analyses" ON analysis_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM analyses
      WHERE analyses.id = analysis_items.analysis_id
      AND analyses.user_id = auth.uid()
    )
  );
