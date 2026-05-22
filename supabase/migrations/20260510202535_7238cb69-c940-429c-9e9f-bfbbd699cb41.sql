
DROP TABLE IF EXISTS public.brand_kits CASCADE;

CREATE TABLE public.brand_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL UNIQUE,
  segment TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  accent_color TEXT,
  font_pair TEXT,
  brand_voice TEXT,
  logo_has_name BOOLEAN DEFAULT false,
  logo_url TEXT,
  main_activity TEXT,
  instagram_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read brand_kits" ON public.brand_kits FOR SELECT USING (true);
