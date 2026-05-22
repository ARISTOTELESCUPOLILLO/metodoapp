-- Add per-plan extras columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS extra_p1_estatico INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_p1_carrossel INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_p1_estatico_final INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_p1_reels INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_p2_estatico INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_p2_carrossel INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_p2_estatico_final INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_p2_reels INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_b_estatico INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_b_carrossel INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_b_estatico_final INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_b_reels INT NOT NULL DEFAULT 0;

-- Backfill: migrate global extras into p1 bucket
UPDATE public.profiles
   SET extra_p1_estatico = GREATEST(extra_p1_estatico, extra_estatico),
       extra_p1_carrossel = GREATEST(extra_p1_carrossel, extra_carrossel),
       extra_p1_estatico_final = GREATEST(extra_p1_estatico_final, extra_estatico_final),
       extra_p1_reels = GREATEST(extra_p1_reels, extra_reels)
 WHERE extra_estatico > 0 OR extra_carrossel > 0 OR extra_estatico_final > 0 OR extra_reels > 0;

-- Drop old global extras columns
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS extra_estatico,
  DROP COLUMN IF EXISTS extra_carrossel,
  DROP COLUMN IF EXISTS extra_estatico_final,
  DROP COLUMN IF EXISTS extra_reels;

-- Update trigger to zero extras per plan when that plan changes
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
    NEW.extra_p1_estatico:=0; NEW.extra_p1_carrossel:=0; NEW.extra_p1_estatico_final:=0; NEW.extra_p1_reels:=0;
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
    NEW.extra_p2_estatico:=0; NEW.extra_p2_carrossel:=0; NEW.extra_p2_estatico_final:=0; NEW.extra_p2_reels:=0;
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
    NEW.extra_b_estatico:=0; NEW.extra_b_carrossel:=0; NEW.extra_b_estatico_final:=0; NEW.extra_b_reels:=0;
  END IF;
  RETURN NEW;
END $function$;