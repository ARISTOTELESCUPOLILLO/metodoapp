-- fill_usage_cost() sobrescrevia incondicionalmente custo_usd com
-- qtd_geracoes * app_settings.geracao_price_usd, descartando o custo real
-- diferenciado por plano (content_pu, mopContentCost S3/S6/S9) que a
-- aplicação já calcula e envia em src/lib/costs.ts. Agora só preenche
-- quando a aplicação não informou nenhum valor (NEW.custo_usd IS NULL).
ALTER TABLE public.usage_logs ALTER COLUMN custo_usd DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.fill_usage_cost()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.custo_usd IS NULL THEN
    NEW.custo_usd := public.calc_cost(
      COALESCE(NEW.qtd_imagens,0),
      COALESCE(NEW.qtd_renders,0),
      COALESCE(NEW.qtd_geracoes,0)
    );
  END IF;
  RETURN NEW;
END;
$function$;
