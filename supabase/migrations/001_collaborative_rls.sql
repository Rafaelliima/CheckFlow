-- 001_collaborative_rls.sql
-- Migração para habilitar leitura colaborativa total entre usuários autenticados.
-- Escrita/atualização/exclusão permanecem restritas ao dono (user_id).

DROP POLICY IF EXISTS "Users can view their own analyses" ON analyses;
DROP POLICY IF EXISTS "Users can view items of their analyses" ON analysis_items;

CREATE POLICY "Authenticated users can view all analyses"
ON analyses
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view all items"
ON analysis_items
FOR SELECT
USING (auth.role() = 'authenticated');
