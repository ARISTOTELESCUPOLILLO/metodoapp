ALTER TABLE public.brand_kits ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS brand_kits_user_id_idx ON public.brand_kits(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS brand_kits_user_id_unique ON public.brand_kits(user_id) WHERE user_id IS NOT NULL;

DROP POLICY IF EXISTS "public read brand_kits" ON public.brand_kits;

CREATE POLICY "brand_kits select own or admin or legacy"
ON public.brand_kits FOR SELECT TO authenticated
USING (user_id = auth.uid() OR user_id IS NULL OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "brand_kits insert own or admin"
ON public.brand_kits FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "brand_kits update own or admin"
ON public.brand_kits FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "brand_kits delete admin"
ON public.brand_kits FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));