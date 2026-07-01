-- FIX DE SEGURANÇA: reset_all_usage() era SECURITY DEFINER sem nenhuma
-- verificação de admin dentro da função nem GRANT/REVOKE restringindo quem
-- pode chamá-la — qualquer usuário autenticado podia executar
-- supabase.rpc("reset_all_usage") direto e apagar TODOS os logs de consumo +
-- zerar os contadores de uso de TODOS os perfis da plataforma.
CREATE OR REPLACE FUNCTION reset_all_usage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem zerar o consumo.';
  END IF;

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

-- FIX DE SEGURANÇA: "settings select authenticated" (USING true) deixava
-- qualquer usuário logado ler app_settings — saldo fal.ai/OpenAI e preços
-- internos de custo — mesmo só telas admin (ajustes.tsx, CustosTab, etc.)
-- lendo essa tabela hoje. Alinha SELECT com a mesma regra já usada em
-- "settings admin write".
DROP POLICY IF EXISTS "settings select authenticated" ON public.app_settings;

CREATE POLICY "settings select admin"
  ON public.app_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
