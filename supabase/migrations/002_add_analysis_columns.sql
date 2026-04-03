-- 002_add_analysis_columns.sql
-- Migração para alinhar colunas usadas pelo app com a tabela analyses.

ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS created_by_email TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
