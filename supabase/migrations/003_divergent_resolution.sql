ALTER TABLE analysis_items
  ADD COLUMN IF NOT EXISTS found_in_analysis_id UUID
    REFERENCES analyses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS found_in_analysis_name TEXT,
  ADD COLUMN IF NOT EXISTS found_at TIMESTAMPTZ;
