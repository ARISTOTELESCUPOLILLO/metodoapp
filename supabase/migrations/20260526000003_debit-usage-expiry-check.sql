-- Adiciona verificação de expiração de plano ao debit_usage.
-- Slots com planoX_expira_em no passado são ignorados — usuário fica bloqueado
-- mesmo que ainda tenha saldo nos contadores.
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
  v_slots text[];
  v_s     text;
BEGIN
  SELECT public.has_role(_user_id, 'admin'::app_role) INTO v_admin;

  IF v_admin THEN
    UPDATE public.profiles
       SET plano1_imgs_usadas     = plano1_imgs_usadas     + COALESCE(_imgs,     0),
           plano1_renders_usados  = plano1_renders_usados  + COALESCE(_renders,  0),
           plano1_geracoes_usadas = plano1_geracoes_usadas + COALESCE(_geracoes, 0)
     WHERE id = _user_id;
    RETURN 'admin';
  END IF;

  SELECT * INTO r FROM public.profiles WHERE id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;

  -- Ordem dos slots: preferred primeiro, depois os demais na ordem padrão
  v_slots := CASE _preferred_slot
    WHEN 'plano2' THEN ARRAY['plano2', 'plano1', 'bonus']
    WHEN 'bonus'  THEN ARRAY['bonus',  'plano1', 'plano2']
    ELSE               ARRAY['plano1', 'plano2', 'bonus']
  END;

  FOREACH v_s IN ARRAY v_slots LOOP
    IF v_s = 'plano1' AND r.plano1_id IS NOT NULL
       AND (r.plano1_expira_em IS NULL OR r.plano1_expira_em > now())
       AND (r.plano1_imgs_limite     - r.plano1_imgs_usadas)     >= COALESCE(_imgs,     0)
       AND (r.plano1_renders_limite  - r.plano1_renders_usados)  >= COALESCE(_renders,  0)
       AND (r.plano1_geracoes_limite - r.plano1_geracoes_usadas) >= COALESCE(_geracoes, 0) THEN
      UPDATE public.profiles
         SET plano1_imgs_usadas     = plano1_imgs_usadas     + COALESCE(_imgs,     0),
             plano1_renders_usados  = plano1_renders_usados  + COALESCE(_renders,  0),
             plano1_geracoes_usadas = plano1_geracoes_usadas + COALESCE(_geracoes, 0)
       WHERE id = _user_id;
      RETURN 'plano1';
    END IF;

    IF v_s = 'plano2' AND r.plano2_id IS NOT NULL
       AND (r.plano2_expira_em IS NULL OR r.plano2_expira_em > now())
       AND (r.plano2_imgs_limite     - r.plano2_imgs_usadas)     >= COALESCE(_imgs,     0)
       AND (r.plano2_renders_limite  - r.plano2_renders_usados)  >= COALESCE(_renders,  0)
       AND (r.plano2_geracoes_limite - r.plano2_geracoes_usadas) >= COALESCE(_geracoes, 0) THEN
      UPDATE public.profiles
         SET plano2_imgs_usadas     = plano2_imgs_usadas     + COALESCE(_imgs,     0),
             plano2_renders_usados  = plano2_renders_usados  + COALESCE(_renders,  0),
             plano2_geracoes_usadas = plano2_geracoes_usadas + COALESCE(_geracoes, 0)
       WHERE id = _user_id;
      RETURN 'plano2';
    END IF;

    IF v_s = 'bonus' AND r.bonus_id IS NOT NULL
       AND (r.bonus_expira_em IS NULL OR r.bonus_expira_em > now())
       AND (r.bonus_imgs_limite     - r.bonus_imgs_usadas)     >= COALESCE(_imgs,     0)
       AND (r.bonus_renders_limite  - r.bonus_renders_usados)  >= COALESCE(_renders,  0)
       AND (r.bonus_geracoes_limite - r.bonus_geracoes_usadas) >= COALESCE(_geracoes, 0) THEN
      UPDATE public.profiles
         SET bonus_imgs_usadas     = bonus_imgs_usadas     + COALESCE(_imgs,     0),
             bonus_renders_usados  = bonus_renders_usados  + COALESCE(_renders,  0),
             bonus_geracoes_usadas = bonus_geracoes_usadas + COALESCE(_geracoes, 0)
       WHERE id = _user_id;
      RETURN 'bonus';
    END IF;
  END LOOP;

  RAISE EXCEPTION 'Limite atingido em todos os planos';
END $function$;
