-- Recalcula custo_total_usd de todos os planos usando os preços unitários
-- atuais de app_settings (image_price_usd, render_price_usd, geracao_price_usd).
-- Execute sempre que alterar preços em Ajustes de custo.
UPDATE plans SET
  custo_total_usd = plans.limite_imagens * s.image_price_usd
                  + plans.limite_renders  * s.render_price_usd
                  + plans.limite_geracoes * s.geracao_price_usd
FROM (
  SELECT image_price_usd, render_price_usd, geracao_price_usd
  FROM app_settings
  WHERE id = true
  LIMIT 1
) s;
