CREATE OR REPLACE FUNCTION public.debit_usage(_user_id uuid, _imgs integer, _renders integer)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin BOOLEAN;
  r RECORD;
BEGIN
  SELECT public.has_role(_user_id, 'admin'::app_role) INTO v_admin;
  IF v_admin THEN RETURN 'admin'; END IF;

  SELECT * INTO r FROM public.profiles WHERE id=_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;

  -- Plano 1 primeiro
  IF r.plano1_id IS NOT NULL
     AND (r.plano1_imgs_limite - r.plano1_imgs_usadas) >= COALESCE(_imgs,0)
     AND (r.plano1_renders_limite - r.plano1_renders_usados) >= COALESCE(_renders,0) THEN
    UPDATE public.profiles
       SET plano1_imgs_usadas = plano1_imgs_usadas + COALESCE(_imgs,0),
           plano1_renders_usados = plano1_renders_usados + COALESCE(_renders,0)
     WHERE id=_user_id;
    RETURN 'plano1';
  END IF;

  -- Plano 2
  IF r.plano2_id IS NOT NULL
     AND (r.plano2_imgs_limite - r.plano2_imgs_usadas) >= COALESCE(_imgs,0)
     AND (r.plano2_renders_limite - r.plano2_renders_usados) >= COALESCE(_renders,0) THEN
    UPDATE public.profiles
       SET plano2_imgs_usadas = plano2_imgs_usadas + COALESCE(_imgs,0),
           plano2_renders_usados = plano2_renders_usados + COALESCE(_renders,0)
     WHERE id=_user_id;
    RETURN 'plano2';
  END IF;

  -- Bônus por último
  IF r.bonus_id IS NOT NULL
     AND (r.bonus_imgs_limite - r.bonus_imgs_usadas) >= COALESCE(_imgs,0)
     AND (r.bonus_renders_limite - r.bonus_renders_usados) >= COALESCE(_renders,0) THEN
    UPDATE public.profiles
       SET bonus_imgs_usadas = bonus_imgs_usadas + COALESCE(_imgs,0),
           bonus_renders_usados = bonus_renders_usados + COALESCE(_renders,0)
     WHERE id=_user_id;
    RETURN 'bonus';
  END IF;

  RAISE EXCEPTION 'Limite atingido em todos os planos';
END $function$;