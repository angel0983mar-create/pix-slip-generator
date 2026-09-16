ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS business_branch text NOT NULL DEFAULT 'mercado',
  ADD COLUMN IF NOT EXISTS store_logo_url text;