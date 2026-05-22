
-- Singleton table for app cost settings
CREATE TABLE IF NOT EXISTS public.app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  image_price_usd numeric NOT NULL DEFAULT 0.38,
  render_price_usd numeric NOT NULL DEFAULT 1.50,
  usd_brl_rate numeric NOT NULL DEFAULT 5.00,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings select authenticated"
  ON public.app_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "settings admin write"
  ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Recreate calc_cost to read prices from app_settings
CREATE OR REPLACE FUNCTION public.calc_cost(_imgs integer, _renders integer)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (COALESCE(_imgs,0)::numeric * (SELECT image_price_usd FROM public.app_settings WHERE id=true))
       + (COALESCE(_renders,0)::numeric * (SELECT render_price_usd FROM public.app_settings WHERE id=true));
$$;
