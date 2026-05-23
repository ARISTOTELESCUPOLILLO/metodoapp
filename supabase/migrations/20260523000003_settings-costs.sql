-- Adiciona custo de imagem base (sem referência) em app_settings
-- e corrige todos os valores unitários para refletir os custos reais

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS image_base_price_usd NUMERIC DEFAULT 0.046;

-- Garante que os valores estejam corretos na linha de configuração
UPDATE public.app_settings SET
  image_base_price_usd = 0.046,
  image_price_usd      = 0.058,
  render_price_usd     = 1.50,
  geracao_price_usd    = 0.003
WHERE id = true;
