-- Remove fallback entre slots no debit_usage.
-- Cada plano é independente: se o slot preferido estiver esgotado ou expirado,
-- a função falha imediatamente sem tentar outros slots.
-- "Bônus encerrado" quando o slot bonus é tentado e está esgotado.

CREATE OR REPLACE FUNCTION public.debit_usage(
  _user_id        uuid,
  _imgs           integer,
  _renders        integer,
  _geracoes       integer DEFAULT 0,
  _preferred_slot text    DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin BOOLEAN;
  r       RECORD;
  v_s     text;
BEGIN
  SELECT public.has_role(_user_id, 'admin'::app_role) INTO v_admin;

  -- Admin: ilimitado — debita direto no slot preferido sem verificar limite
  IF v_admin THEN
    v_s := COALESCE(_preferred_slot, 'plano1');
    IF v_s = 'plano2' THEN
      UPDATE public.profiles
         SET plano2_imgs_usadas     = plano2_imgs_usadas     + COALESCE(_imgs,     0),
             plano2_renders_usados  = plano2_renders_usados  + COALESCE(_renders,  0),
             plano2_geracoes_usadas = plano2_geracoes_usadas + COALESCE(_geracoes, 0)
       WHERE id = _user_id;
    ELSIF v_s = 'bonus' THEN
      UPDATE public.profiles
         SET bonus_imgs_usadas     = bonus_imgs_usadas     + COALESCE(_imgs,     0),
             bonus_renders_usados  = bonus_renders_usados  + COALESCE(_renders,  0),
             bonus_geracoes_usadas = bonus_geracoes_usadas + COALESCE(_geracoes, 0)
       WHERE id = _user_id;
    ELSE
      UPDATE public.profiles
         SET plano1_imgs_usadas     = plano1_imgs_usadas     + COALESCE(_imgs,     0),
             plano1_renders_usados  = plano1_renders_usados  + COALESCE(_renders,  0),
             plano1_geracoes_usadas = plano1_geracoes_usadas + COALESCE(_geracoes, 0)
       WHERE id = _user_id;
    END IF;
    RETURN 'admin';
  END IF;

  -- Usuário comum: tenta APENAS o slot preferido (sem fallback para outros slots)
  SELECT * INTO r FROM public.profiles WHERE id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;

  v_s := COALESCE(_preferred_slot, 'plano1');

  IF v_s = 'plano1' AND r.plano1_id IS NOT NULL
     AND (r.plano1_expira_em IS NULL OR r.plano1_expira_em > now())
     AND (r.plano1_imgs_limite     = 0 OR (r.plano1_imgs_limite     - r.plano1_imgs_usadas)     >= COALESCE(_imgs,     0))
     AND (r.plano1_renders_limite  = 0 OR (r.plano1_renders_limite  - r.plano1_renders_usados)  >= COALESCE(_renders,  0))
     AND (r.plano1_geracoes_limite = 0 OR (r.plano1_geracoes_limite - r.plano1_geracoes_usadas) >= COALESCE(_geracoes, 0)) THEN
    UPDATE public.profiles
       SET plano1_imgs_usadas     = plano1_imgs_usadas     + COALESCE(_imgs,     0),
           plano1_renders_usados  = plano1_renders_usados  + COALESCE(_renders,  0),
           plano1_geracoes_usadas = plano1_geracoes_usadas + COALESCE(_geracoes, 0)
     WHERE id = _user_id;
    RETURN 'plano1';
  END IF;

  IF v_s = 'plano2' AND r.plano2_id IS NOT NULL
     AND (r.plano2_expira_em IS NULL OR r.plano2_expira_em > now())
     AND (r.plano2_imgs_limite     = 0 OR (r.plano2_imgs_limite     - r.plano2_imgs_usadas)     >= COALESCE(_imgs,     0))
     AND (r.plano2_renders_limite  = 0 OR (r.plano2_renders_limite  - r.plano2_renders_usados)  >= COALESCE(_renders,  0))
     AND (r.plano2_geracoes_limite = 0 OR (r.plano2_geracoes_limite - r.plano2_geracoes_usadas) >= COALESCE(_geracoes, 0)) THEN
    UPDATE public.profiles
       SET plano2_imgs_usadas     = plano2_imgs_usadas     + COALESCE(_imgs,     0),
           plano2_renders_usados  = plano2_renders_usados  + COALESCE(_renders,  0),
           plano2_geracoes_usadas = plano2_geracoes_usadas + COALESCE(_geracoes, 0)
     WHERE id = _user_id;
    RETURN 'plano2';
  END IF;

  IF v_s = 'bonus' AND r.bonus_id IS NOT NULL
     AND (r.bonus_expira_em IS NULL OR r.bonus_expira_em > now())
     AND (r.bonus_imgs_limite     = 0 OR (r.bonus_imgs_limite     - r.bonus_imgs_usadas)     >= COALESCE(_imgs,     0))
     AND (r.bonus_renders_limite  = 0 OR (r.bonus_renders_limite  - r.bonus_renders_usados)  >= COALESCE(_renders,  0))
     AND (r.bonus_geracoes_limite = 0 OR (r.bonus_geracoes_limite - r.bonus_geracoes_usadas) >= COALESCE(_geracoes, 0)) THEN
    UPDATE public.profiles
       SET bonus_imgs_usadas     = bonus_imgs_usadas     + COALESCE(_imgs,     0),
           bonus_renders_usados  = bonus_renders_usados  + COALESCE(_renders,  0),
           bonus_geracoes_usadas = bonus_geracoes_usadas + COALESCE(_geracoes, 0)
     WHERE id = _user_id;
    RETURN 'bonus';
  END IF;

  -- Mensagem específica por slot
  IF v_s = 'bonus' THEN
    RAISE EXCEPTION 'Bônus encerrado';
  ELSE
    RAISE EXCEPTION 'Plano esgotado — renove para continuar';
  END IF;
END $function$;
