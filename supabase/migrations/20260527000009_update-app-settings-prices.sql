-- Atualiza os preços unitários em app_settings para os valores reais de operação.
-- Câmbio: R$ 5,80 / US$ 1
-- Render/vídeo: US$ 1,60 por render
-- Geração de texto: US$ 0,013 por geração
UPDATE app_settings SET
  usd_brl_rate       = 5.80,
  render_price_usd   = 1.60,
  geracao_price_usd  = 0.013
WHERE id = true;
