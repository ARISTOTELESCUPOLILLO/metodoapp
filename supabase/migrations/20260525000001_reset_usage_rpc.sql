-- RPC para zerar todo o consumo: deleta os logs e reseta os contadores nos perfis.
-- Usada pelo botão "Zerar Consumo" no painel admin (CustosTab).
CREATE OR REPLACE FUNCTION reset_all_usage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM usage_logs;
  UPDATE profiles SET
    plano1_imgs_usadas    = 0,
    plano1_renders_usados = 0,
    plano1_geracoes_usadas = 0,
    plano2_imgs_usadas    = 0,
    plano2_renders_usados = 0,
    plano2_geracoes_usadas = 0,
    bonus_imgs_usadas     = 0,
    bonus_renders_usados  = 0,
    bonus_geracoes_usadas = 0;
END;
$$;
