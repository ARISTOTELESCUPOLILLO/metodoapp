-- ============================================================
-- Validade de 30 dias por plano: adiciona plano_expira_em
-- Regra: expira_em = inicio + 1 mês (mesmo dia do mês seguinte).
-- Atualizado automaticamente em dois eventos:
--   1. Quando plano_id muda (novo plano atribuído)
--   2. Quando plano_inicio muda diretamente (renovação manual)
-- ============================================================

-- 1. Novas colunas
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plano1_expira_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plano2_expira_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bonus_expira_em  TIMESTAMPTZ;

-- 2. Backfill dos registros existentes
UPDATE public.profiles
   SET plano1_expira_em = plano1_inicio + interval '1 month'
 WHERE plano1_inicio IS NOT NULL AND plano1_expira_em IS NULL;

UPDATE public.profiles
   SET plano2_expira_em = plano2_inicio + interval '1 month'
 WHERE plano2_inicio IS NOT NULL AND plano2_expira_em IS NULL;

UPDATE public.profiles
   SET bonus_expira_em = bonus_inicio + interval '1 month'
 WHERE bonus_inicio IS NOT NULL AND bonus_expira_em IS NULL;

-- 3. Atualiza trigger apply_slot_limits para manter expira_em
CREATE OR REPLACE FUNCTION public.apply_slot_limits()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_li INT; v_lr INT; v_lg INT; v_bonus BOOLEAN;
BEGIN

  -- ── PLANO 1 ─────────────────────────────────────────────────
  IF TG_OP='INSERT' OR NEW.plano1_id IS DISTINCT FROM OLD.plano1_id THEN
    IF NEW.plano1_id IS NULL THEN
      NEW.plano1_imgs_limite     := 0; NEW.plano1_renders_limite   := 0; NEW.plano1_geracoes_limite  := 0;
      NEW.plano1_imgs_usadas     := 0; NEW.plano1_renders_usados   := 0; NEW.plano1_geracoes_usadas  := 0;
      NEW.plano1_inicio          := NULL;
      NEW.plano1_expira_em       := NULL;
    ELSE
      SELECT limite_imagens, limite_renders, limite_geracoes
        INTO v_li, v_lr, v_lg FROM public.plans WHERE id = NEW.plano1_id;
      NEW.plano1_imgs_limite     := COALESCE(v_li, 0);
      NEW.plano1_renders_limite  := COALESCE(v_lr, 0);
      NEW.plano1_geracoes_limite := COALESCE(v_lg, 0);
      NEW.plano1_imgs_usadas     := 0; NEW.plano1_renders_usados   := 0; NEW.plano1_geracoes_usadas  := 0;
      NEW.plano1_inicio          := now();
      NEW.plano1_expira_em       := now() + interval '1 month';
    END IF;
    NEW.extra_p1_estatico := 0; NEW.extra_p1_carrossel := 0;
    NEW.extra_p1_estatico_final := 0; NEW.extra_p1_reels := 0;

  ELSIF NEW.plano1_inicio IS DISTINCT FROM OLD.plano1_inicio THEN
    -- Renovação manual de ciclo: só recalcula expira_em, não mexe em contadores
    NEW.plano1_expira_em := CASE
      WHEN NEW.plano1_inicio IS NULL THEN NULL
      ELSE NEW.plano1_inicio + interval '1 month'
    END;
  END IF;

  -- ── PLANO 2 ─────────────────────────────────────────────────
  IF TG_OP='INSERT' OR NEW.plano2_id IS DISTINCT FROM OLD.plano2_id THEN
    IF NEW.plano2_id IS NULL THEN
      NEW.plano2_imgs_limite     := 0; NEW.plano2_renders_limite   := 0; NEW.plano2_geracoes_limite  := 0;
      NEW.plano2_imgs_usadas     := 0; NEW.plano2_renders_usados   := 0; NEW.plano2_geracoes_usadas  := 0;
      NEW.plano2_inicio          := NULL;
      NEW.plano2_expira_em       := NULL;
    ELSE
      SELECT limite_imagens, limite_renders, limite_geracoes
        INTO v_li, v_lr, v_lg FROM public.plans WHERE id = NEW.plano2_id;
      NEW.plano2_imgs_limite     := COALESCE(v_li, 0);
      NEW.plano2_renders_limite  := COALESCE(v_lr, 0);
      NEW.plano2_geracoes_limite := COALESCE(v_lg, 0);
      NEW.plano2_imgs_usadas     := 0; NEW.plano2_renders_usados   := 0; NEW.plano2_geracoes_usadas  := 0;
      NEW.plano2_inicio          := now();
      NEW.plano2_expira_em       := now() + interval '1 month';
    END IF;
    NEW.extra_p2_estatico := 0; NEW.extra_p2_carrossel := 0;
    NEW.extra_p2_estatico_final := 0; NEW.extra_p2_reels := 0;

  ELSIF NEW.plano2_inicio IS DISTINCT FROM OLD.plano2_inicio THEN
    NEW.plano2_expira_em := CASE
      WHEN NEW.plano2_inicio IS NULL THEN NULL
      ELSE NEW.plano2_inicio + interval '1 month'
    END;
  END IF;

  -- ── BÔNUS ───────────────────────────────────────────────────
  IF TG_OP='INSERT' OR NEW.bonus_id IS DISTINCT FROM OLD.bonus_id THEN
    IF NEW.bonus_id IS NULL THEN
      NEW.bonus_imgs_limite     := 0; NEW.bonus_renders_limite   := 0; NEW.bonus_geracoes_limite  := 0;
      NEW.bonus_imgs_usadas     := 0; NEW.bonus_renders_usados   := 0; NEW.bonus_geracoes_usadas  := 0;
      NEW.bonus_inicio          := NULL;
      NEW.bonus_expira_em       := NULL;
    ELSE
      SELECT limite_imagens, limite_renders, limite_geracoes, elegivel_bonus
        INTO v_li, v_lr, v_lg, v_bonus FROM public.plans WHERE id = NEW.bonus_id;
      IF NOT COALESCE(v_bonus, false) THEN
        RAISE EXCEPTION 'Plano selecionado não é elegível para bônus';
      END IF;
      NEW.bonus_imgs_limite     := COALESCE(v_li, 0);
      NEW.bonus_renders_limite  := COALESCE(v_lr, 0);
      NEW.bonus_geracoes_limite := COALESCE(v_lg, 0);
      NEW.bonus_imgs_usadas     := 0; NEW.bonus_renders_usados   := 0; NEW.bonus_geracoes_usadas  := 0;
      NEW.bonus_inicio          := now();
      NEW.bonus_expira_em       := now() + interval '1 month';
    END IF;
    NEW.extra_b_estatico := 0; NEW.extra_b_carrossel := 0;
    NEW.extra_b_estatico_final := 0; NEW.extra_b_reels := 0;

  ELSIF NEW.bonus_inicio IS DISTINCT FROM OLD.bonus_inicio THEN
    NEW.bonus_expira_em := CASE
      WHEN NEW.bonus_inicio IS NULL THEN NULL
      ELSE NEW.bonus_inicio + interval '1 month'
    END;
  END IF;

  RETURN NEW;
END $function$;
