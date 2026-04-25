-- Add new sales control columns to crm_sales table
ALTER TABLE public.crm_sales 
  ADD COLUMN IF NOT EXISTS competitor TEXT,
  ADD COLUMN IF NOT EXISTS lead_source TEXT,
  ADD COLUMN IF NOT EXISTS installation_period TEXT,
  ADD COLUMN IF NOT EXISTS needs_extra_router BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS needs_portability BOOLEAN DEFAULT FALSE;
