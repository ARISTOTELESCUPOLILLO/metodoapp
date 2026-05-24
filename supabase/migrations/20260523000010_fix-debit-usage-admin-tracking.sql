-- Bug fix: debit_usage now tracks admin usage in profiles counters
-- Previously returned 'admin' immediately without touching any counter,
-- making admin usage invisible in UsersTab (reads plano1_*_usadas from profiles).
-- Admins still have no limits enforced — counters just accumulate for visibility.
CREATE OR REPLACE FUNCTION public.debit_usage(
  _user_id  uuid,
  _imgs     integer,
  _renders  integer,
  _geracoes integer DEFAULT 0
)
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

  IF v_admin THEN
    -- Track usage without enforcing limits
    UPDATE public.profiles
       SET plano1_imgs_usadas      = plano1_imgs_usadas      + COALESCE(_imgs,     0),
           plano1_renders_usados   = plano1_renders_usados   + COALESCE(_renders,  0),
           plano1_geracoes_usadas  = plano1_geracoes_usadas  + COALESCE(_geracoes, 0)
     WHERE id = _user_id;
    RETURN 'admin';
  END IF;

  SELECT * INTO r FROM public.profiles WHERE id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;

  IF r.plano1_id IS NOT NULL
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

  IF r.plano2_id IS NOT NULL
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

  IF r.bonus_id IS NOT NULL
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

  RAISE EXCEPTION 'Limite atingido em todos os planos';
END $function$;
