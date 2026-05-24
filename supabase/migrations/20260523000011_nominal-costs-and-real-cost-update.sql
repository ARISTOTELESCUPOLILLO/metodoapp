-- Adiciona colunas de custo nominal em app_settings
-- (custo nominal = o que fal.ai/OpenAI cobram; custo real = o que cobramos do cliente)
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS image_edit_price_usd   NUMERIC(10,4) NOT NULL DEFAULT 0.0800,
  ADD COLUMN IF NOT EXISTS image_nominal_usd       NUMERIC(10,4) NOT NULL DEFAULT 0.0500,
  ADD COLUMN IF NOT EXISTS image_edit_nominal_usd  NUMERIC(10,4) NOT NULL DEFAULT 0.0600,
  ADD COLUMN IF NOT EXISTS render_nominal_usd      NUMERIC(10,4) NOT NULL DEFAULT 1.5000,
  ADD COLUMN IF NOT EXISTS geracao_nominal_usd     NUMERIC(10,4) NOT NULL DEFAULT 0.0100;

-- Atualiza custos reais e nominais na linha singleton
UPDATE public.app_settings SET
  image_base_price_usd   = 0.0600,
  image_price_usd        = 0.0800,
  image_edit_price_usd   = 0.0800,
  render_price_usd       = 1.6000,
  geracao_price_usd      = 0.0130,
  image_nominal_usd      = 0.0500,
  image_edit_nominal_usd = 0.0600,
  render_nominal_usd     = 1.5000,
  geracao_nominal_usd    = 0.0100;
