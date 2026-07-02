-- ============================================================
-- debit_usage: adiciona os 2 contadores de texto (regen_texto e sugestoes).
--
-- Base: 20260606000003_debit-usage-remove-admin-bypass.sql (5 args, sem bypass
-- de admin). Acrescenta _regen_texto e _sugestoes (ambos DEFAULT 0), checando e
-- debitando junto com imgs/renders/geracoes no slot preferido. Mantém a
-- convenção limite = 0 → ILIMITADO e NÃO reabre o bypass de admin.
--
-- IMPORTANTE: dropa a assinatura antiga de 5 args ANTES de recriar a de 7 —
-- senão o Postgres fica com 2 overloads e recusa as chamadas por ambiguidade
-- ("Could not choose the best candidate function").
-- ============================================================

DROP FUNCTION IF EXISTS public.debit_usage(uuid, integer, integer, integer, text);

CREATE OR REPLACE FUNCTION public.debit_usage(
  _user_id        uuid,
  _imgs           integer,
  _renders        integer,
  _geracoes       integer DEFAULT 0,
  _preferred_slot text    DEFAULT NULL,
  _regen_texto    integer DEFAULT 0,
  _sugestoes      integer DEFAULT 0
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r  RECORD;
  v_s text;
BEGIN
  SELECT * INTO r FROM public.profiles WHERE id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;

  v_s := COALESCE(_preferred_slot, 'plano1');

  IF v_s = 'plano1' AND r.plano1_id IS NOT NULL
     AND (r.plano1_expira_em IS NULL OR r.plano1_expira_em > now())
     AND (r.plano1_imgs_limite        = 0 OR (r.plano1_imgs_limite        - r.plano1_imgs_usadas)        >= COALESCE(_imgs,        0))
     AND (r.plano1_renders_limite     = 0 OR (r.plano1_renders_limite     - r.plano1_renders_usados)     >= COALESCE(_renders,     0))
     AND (r.plano1_geracoes_limite    = 0 OR (r.plano1_geracoes_limite    - r.plano1_geracoes_usadas)    >= COALESCE(_geracoes,    0))
     AND (r.plano1_regen_texto_limite = 0 OR (r.plano1_regen_texto_limite - r.plano1_regen_texto_usadas) >= COALESCE(_regen_texto, 0))
     AND (r.plano1_sugestoes_limite   = 0 OR (r.plano1_sugestoes_limite   - r.plano1_sugestoes_usadas)   >= COALESCE(_sugestoes,   0)) THEN
    UPDATE public.profiles
       SET plano1_imgs_usadas        = plano1_imgs_usadas        + COALESCE(_imgs,        0),
           plano1_renders_usados     = plano1_renders_usados     + COALESCE(_renders,     0),
           plano1_geracoes_usadas    = plano1_geracoes_usadas    + COALESCE(_geracoes,    0),
           plano1_regen_texto_usadas = plano1_regen_texto_usadas + COALESCE(_regen_texto, 0),
           plano1_sugestoes_usadas   = plano1_sugestoes_usadas   + COALESCE(_sugestoes,   0)
     WHERE id = _user_id;
    RETURN 'plano1';
  END IF;

  IF v_s = 'plano2' AND r.plano2_id IS NOT NULL
     AND (r.plano2_expira_em IS NULL OR r.plano2_expira_em > now())
     AND (r.plano2_imgs_limite        = 0 OR (r.plano2_imgs_limite        - r.plano2_imgs_usadas)        >= COALESCE(_imgs,        0))
     AND (r.plano2_renders_limite     = 0 OR (r.plano2_renders_limite     - r.plano2_renders_usados)     >= COALESCE(_renders,     0))
     AND (r.plano2_geracoes_limite    = 0 OR (r.plano2_geracoes_limite    - r.plano2_geracoes_usadas)    >= COALESCE(_geracoes,    0))
     AND (r.plano2_regen_texto_limite = 0 OR (r.plano2_regen_texto_limite - r.plano2_regen_texto_usadas) >= COALESCE(_regen_texto, 0))
     AND (r.plano2_sugestoes_limite   = 0 OR (r.plano2_sugestoes_limite   - r.plano2_sugestoes_usadas)   >= COALESCE(_sugestoes,   0)) THEN
    UPDATE public.profiles
       SET plano2_imgs_usadas        = plano2_imgs_usadas        + COALESCE(_imgs,        0),
           plano2_renders_usados     = plano2_renders_usados     + COALESCE(_renders,     0),
           plano2_geracoes_usadas    = plano2_geracoes_usadas    + COALESCE(_geracoes,    0),
           plano2_regen_texto_usadas = plano2_regen_texto_usadas + COALESCE(_regen_texto, 0),
           plano2_sugestoes_usadas   = plano2_sugestoes_usadas   + COALESCE(_sugestoes,   0)
     WHERE id = _user_id;
    RETURN 'plano2';
  END IF;

  IF v_s = 'bonus' AND r.bonus_id IS NOT NULL
     AND (r.bonus_expira_em IS NULL OR r.bonus_expira_em > now())
     AND (r.bonus_imgs_limite        = 0 OR (r.bonus_imgs_limite        - r.bonus_imgs_usadas)        >= COALESCE(_imgs,        0))
     AND (r.bonus_renders_limite     = 0 OR (r.bonus_renders_limite     - r.bonus_renders_usados)     >= COALESCE(_renders,     0))
     AND (r.bonus_geracoes_limite    = 0 OR (r.bonus_geracoes_limite    - r.bonus_geracoes_usadas)    >= COALESCE(_geracoes,    0))
     AND (r.bonus_regen_texto_limite = 0 OR (r.bonus_regen_texto_limite - r.bonus_regen_texto_usadas) >= COALESCE(_regen_texto, 0))
     AND (r.bonus_sugestoes_limite   = 0 OR (r.bonus_sugestoes_limite   - r.bonus_sugestoes_usadas)   >= COALESCE(_sugestoes,   0)) THEN
    UPDATE public.profiles
       SET bonus_imgs_usadas        = bonus_imgs_usadas        + COALESCE(_imgs,        0),
           bonus_renders_usados     = bonus_renders_usados     + COALESCE(_renders,     0),
           bonus_geracoes_usadas    = bonus_geracoes_usadas    + COALESCE(_geracoes,    0),
           bonus_regen_texto_usadas = bonus_regen_texto_usadas + COALESCE(_regen_texto, 0),
           bonus_sugestoes_usadas   = bonus_sugestoes_usadas   + COALESCE(_sugestoes,   0)
     WHERE id = _user_id;
    RETURN 'bonus';
  END IF;

  IF v_s = 'bonus' THEN
    RAISE EXCEPTION 'Bônus encerrado';
  ELSE
    RAISE EXCEPTION 'Plano esgotado — renove para continuar';
  END IF;
END $function$;
