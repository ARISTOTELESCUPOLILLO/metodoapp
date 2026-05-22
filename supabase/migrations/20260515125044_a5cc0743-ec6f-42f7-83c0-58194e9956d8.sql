
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS limite_geracoes integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plano1_geracoes_limite integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plano1_geracoes_usadas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plano2_geracoes_limite integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plano2_geracoes_usadas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_geracoes_limite integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_geracoes_usadas integer NOT NULL DEFAULT 0;

ALTER TABLE public.usage_logs ADD COLUMN IF NOT EXISTS qtd_geracoes integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.apply_slot_limits()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_li INT; v_lr INT; v_lg INT; v_bonus BOOLEAN;
BEGIN
  IF TG_OP='INSERT' OR NEW.plano1_id IS DISTINCT FROM OLD.plano1_id THEN
    IF NEW.plano1_id IS NULL THEN
      NEW.plano1_imgs_limite:=0; NEW.plano1_renders_limite:=0; NEW.plano1_geracoes_limite:=0;
      NEW.plano1_imgs_usadas:=0; NEW.plano1_renders_usados:=0; NEW.plano1_geracoes_usadas:=0;
      NEW.plano1_inicio:=NULL;
    ELSE
      SELECT limite_imagens, limite_renders, limite_geracoes INTO v_li, v_lr, v_lg FROM public.plans WHERE id=NEW.plano1_id;
      NEW.plano1_imgs_limite:=COALESCE(v_li,0); NEW.plano1_renders_limite:=COALESCE(v_lr,0); NEW.plano1_geracoes_limite:=COALESCE(v_lg,0);
      NEW.plano1_imgs_usadas:=0; NEW.plano1_renders_usados:=0; NEW.plano1_geracoes_usadas:=0;
      NEW.plano1_inicio:=now();
    END IF;
  END IF;
  IF TG_OP='INSERT' OR NEW.plano2_id IS DISTINCT FROM OLD.plano2_id THEN
    IF NEW.plano2_id IS NULL THEN
      NEW.plano2_imgs_limite:=0; NEW.plano2_renders_limite:=0; NEW.plano2_geracoes_limite:=0;
      NEW.plano2_imgs_usadas:=0; NEW.plano2_renders_usados:=0; NEW.plano2_geracoes_usadas:=0;
      NEW.plano2_inicio:=NULL;
    ELSE
      SELECT limite_imagens, limite_renders, limite_geracoes INTO v_li, v_lr, v_lg FROM public.plans WHERE id=NEW.plano2_id;
      NEW.plano2_imgs_limite:=COALESCE(v_li,0); NEW.plano2_renders_limite:=COALESCE(v_lr,0); NEW.plano2_geracoes_limite:=COALESCE(v_lg,0);
      NEW.plano2_imgs_usadas:=0; NEW.plano2_renders_usados:=0; NEW.plano2_geracoes_usadas:=0;
      NEW.plano2_inicio:=now();
    END IF;
  END IF;
  IF TG_OP='INSERT' OR NEW.bonus_id IS DISTINCT FROM OLD.bonus_id THEN
    IF NEW.bonus_id IS NULL THEN
      NEW.bonus_imgs_limite:=0; NEW.bonus_renders_limite:=0; NEW.bonus_geracoes_limite:=0;
      NEW.bonus_imgs_usadas:=0; NEW.bonus_renders_usados:=0; NEW.bonus_geracoes_usadas:=0;
      NEW.bonus_inicio:=NULL;
    ELSE
      SELECT limite_imagens, limite_renders, limite_geracoes, elegivel_bonus
        INTO v_li, v_lr, v_lg, v_bonus FROM public.plans WHERE id=NEW.bonus_id;
      IF NOT COALESCE(v_bonus,false) THEN
        RAISE EXCEPTION 'Plano selecionado não é elegível para bônus';
      END IF;
      NEW.bonus_imgs_limite:=COALESCE(v_li,0); NEW.bonus_renders_limite:=COALESCE(v_lr,0); NEW.bonus_geracoes_limite:=COALESCE(v_lg,0);
      NEW.bonus_imgs_usadas:=0; NEW.bonus_renders_usados:=0; NEW.bonus_geracoes_usadas:=0;
      NEW.bonus_inicio:=now();
    END IF;
  END IF;
  RETURN NEW;
END $function$;

DROP FUNCTION IF EXISTS public.debit_usage(uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.debit_usage(_user_id uuid, _imgs integer, _renders integer, _geracoes integer DEFAULT 0)
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

  IF r.plano1_id IS NOT NULL
     AND (r.plano1_imgs_limite - r.plano1_imgs_usadas) >= COALESCE(_imgs,0)
     AND (r.plano1_renders_limite - r.plano1_renders_usados) >= COALESCE(_renders,0)
     AND (r.plano1_geracoes_limite - r.plano1_geracoes_usadas) >= COALESCE(_geracoes,0) THEN
    UPDATE public.profiles
       SET plano1_imgs_usadas = plano1_imgs_usadas + COALESCE(_imgs,0),
           plano1_renders_usados = plano1_renders_usados + COALESCE(_renders,0),
           plano1_geracoes_usadas = plano1_geracoes_usadas + COALESCE(_geracoes,0)
     WHERE id=_user_id;
    RETURN 'plano1';
  END IF;

  IF r.plano2_id IS NOT NULL
     AND (r.plano2_imgs_limite - r.plano2_imgs_usadas) >= COALESCE(_imgs,0)
     AND (r.plano2_renders_limite - r.plano2_renders_usados) >= COALESCE(_renders,0)
     AND (r.plano2_geracoes_limite - r.plano2_geracoes_usadas) >= COALESCE(_geracoes,0) THEN
    UPDATE public.profiles
       SET plano2_imgs_usadas = plano2_imgs_usadas + COALESCE(_imgs,0),
           plano2_renders_usados = plano2_renders_usados + COALESCE(_renders,0),
           plano2_geracoes_usadas = plano2_geracoes_usadas + COALESCE(_geracoes,0)
     WHERE id=_user_id;
    RETURN 'plano2';
  END IF;

  IF r.bonus_id IS NOT NULL
     AND (r.bonus_imgs_limite - r.bonus_imgs_usadas) >= COALESCE(_imgs,0)
     AND (r.bonus_renders_limite - r.bonus_renders_usados) >= COALESCE(_renders,0)
     AND (r.bonus_geracoes_limite - r.bonus_geracoes_usadas) >= COALESCE(_geracoes,0) THEN
    UPDATE public.profiles
       SET bonus_imgs_usadas = bonus_imgs_usadas + COALESCE(_imgs,0),
           bonus_renders_usados = bonus_renders_usados + COALESCE(_renders,0),
           bonus_geracoes_usadas = bonus_geracoes_usadas + COALESCE(_geracoes,0)
     WHERE id=_user_id;
    RETURN 'bonus';
  END IF;

  RAISE EXCEPTION 'Limite atingido em todos os planos';
END $function$;
