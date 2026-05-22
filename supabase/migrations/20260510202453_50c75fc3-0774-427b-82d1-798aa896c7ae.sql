
CREATE TABLE public.brand_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  segment TEXT,
  colors JSONB,
  font_pair JSONB,
  brand_voice JSONB,
  logo TEXT,
  main_activity TEXT,
  instagram_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read brand_kits" ON public.brand_kits FOR SELECT USING (true);
CREATE POLICY "public write brand_kits" ON public.brand_kits FOR INSERT WITH CHECK (true);
CREATE POLICY "public update brand_kits" ON public.brand_kits FOR UPDATE USING (true);
CREATE POLICY "public delete brand_kits" ON public.brand_kits FOR DELETE USING (true);

INSERT INTO storage.buckets (id, name, public) VALUES ('pdfs', 'pdfs', true);

CREATE POLICY "public read pdfs" ON storage.objects FOR SELECT USING (bucket_id = 'pdfs');
CREATE POLICY "public write pdfs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'pdfs');
CREATE POLICY "public update pdfs" ON storage.objects FOR UPDATE USING (bucket_id = 'pdfs');
