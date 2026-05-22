
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS geracao_price_usd numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.calc_cost(_imgs integer, _renders integer, _geracoes integer DEFAULT 0)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT (COALESCE(_imgs,0)::numeric    * (SELECT image_price_usd    FROM public.app_settings WHERE id=true))
       + (COALESCE(_renders,0)::numeric * (SELECT render_price_usd   FROM public.app_settings WHERE id=true))
       + (COALESCE(_geracoes,0)::numeric* (SELECT geracao_price_usd  FROM public.app_settings WHERE id=true));
$function$;

CREATE OR REPLACE FUNCTION public.fill_usage_cost()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.custo_usd := public.calc_cost(
    COALESCE(NEW.qtd_imagens,0),
    COALESCE(NEW.qtd_renders,0),
    COALESCE(NEW.qtd_geracoes,0)
  );
  RETURN NEW;
END;
$function$;
