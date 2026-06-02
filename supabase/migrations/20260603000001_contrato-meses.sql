-- ============================================================
-- Período de contratação por slot: meses_contrato e contrato_fim
-- Ciclo de 30 dias (expira_em) permanece como tracker de consumo.
-- contrato_fim = inicio + N meses (fim total do contrato).
-- Auto-renovação via pg_cron: reseta consumo a cada 30 dias enquanto
-- contrato_fim não foi atingido.
-- ============================================================

-- 1. Novas colunas
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plano1_meses_contrato INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS plano2_meses_contrato INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS bonus_meses_contrato  INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS plano1_contrato_fim   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plano2_contrato_fim   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bonus_contrato_fim     TIMESTAMPTZ;

-- 2. Backfill: contratos existentes = 1 mês, contrato_fim = expira_em atual
UPDATE public.profiles SET plano1_contrato_fim = plano1_expira_em WHERE plano1_id IS NOT NULL AND plano1_contrato_fim IS NULL;
UPDATE public.profiles SET plano2_contrato_fim = plano2_expira_em WHERE plano2_id IS NOT NULL AND plano2_contrato_fim IS NULL;
UPDATE public.profiles SET bonus_contrato_fim  = bonus_expira_em  WHERE bonus_id  IS NOT NULL AND bonus_contrato_fim  IS NULL;

-- 3. Atualiza trigger apply_slot_limits para suportar meses_contrato e contrato_fim
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
      NEW.plano1_contrato_fim    := NULL;
      NEW.plano1_meses_contrato  := 1;
    ELSE
      SELECT limite_imagens, limite_renders, limite_geracoes
        INTO v_li, v_lr, v_lg FROM public.plans WHERE id = NEW.plano1_id;
      NEW.plano1_imgs_limite     := COALESCE(v_li, 0);
      NEW.plano1_renders_limite  := COALESCE(v_lr, 0);
      NEW.plano1_geracoes_limite := COALESCE(v_lg, 0);
      NEW.plano1_imgs_usadas     := 0; NEW.plano1_renders_usados   := 0; NEW.plano1_geracoes_usadas  := 0;
      NEW.plano1_inicio          := now();
      NEW.plano1_expira_em       := now() + interval '1 month';
      NEW.plano1_contrato_fim    := now() + (NEW.plano1_meses_contrato * interval '1 month');
    END IF;
    NEW.extra_p1_estatico := 0; NEW.extra_p1_carrossel := 0;
    NEW.extra_p1_estatico_final := 0; NEW.extra_p1_reels := 0;

  ELSIF NEW.plano1_inicio IS DISTINCT FROM OLD.plano1_inicio THEN
    -- Renovação de ciclo: recalcula só expira_em; contrato_fim não muda
    NEW.plano1_expira_em := CASE
      WHEN NEW.plano1_inicio IS NULL THEN NULL
      ELSE NEW.plano1_inicio + interval '1 month'
    END;

  ELSIF NEW.plano1_meses_contrato IS DISTINCT FROM OLD.plano1_meses_contrato THEN
    -- Admin ajustou duração sem trocar plano: recalcula contrato_fim
    NEW.plano1_contrato_fim := CASE
      WHEN NEW.plano1_inicio IS NULL THEN NULL
      ELSE NEW.plano1_inicio + (NEW.plano1_meses_contrato * interval '1 month')
    END;
  END IF;

  -- ── PLANO 2 ─────────────────────────────────────────────────
  IF TG_OP='INSERT' OR NEW.plano2_id IS DISTINCT FROM OLD.plano2_id THEN
    IF NEW.plano2_id IS NULL THEN
      NEW.plano2_imgs_limite     := 0; NEW.plano2_renders_limite   := 0; NEW.plano2_geracoes_limite  := 0;
      NEW.plano2_imgs_usadas     := 0; NEW.plano2_renders_usados   := 0; NEW.plano2_geracoes_usadas  := 0;
      NEW.plano2_inicio          := NULL;
      NEW.plano2_expira_em       := NULL;
      NEW.plano2_contrato_fim    := NULL;
      NEW.plano2_meses_contrato  := 1;
    ELSE
      SELECT limite_imagens, limite_renders, limite_geracoes
        INTO v_li, v_lr, v_lg FROM public.plans WHERE id = NEW.plano2_id;
      NEW.plano2_imgs_limite     := COALESCE(v_li, 0);
      NEW.plano2_renders_limite  := COALESCE(v_lr, 0);
      NEW.plano2_geracoes_limite := COALESCE(v_lg, 0);
      NEW.plano2_imgs_usadas     := 0; NEW.plano2_renders_usados   := 0; NEW.plano2_geracoes_usadas  := 0;
      NEW.plano2_inicio          := now();
      NEW.plano2_expira_em       := now() + interval '1 month';
      NEW.plano2_contrato_fim    := now() + (NEW.plano2_meses_contrato * interval '1 month');
    END IF;
    NEW.extra_p2_estatico := 0; NEW.extra_p2_carrossel := 0;
    NEW.extra_p2_estatico_final := 0; NEW.extra_p2_reels := 0;

  ELSIF NEW.plano2_inicio IS DISTINCT FROM OLD.plano2_inicio THEN
    NEW.plano2_expira_em := CASE
      WHEN NEW.plano2_inicio IS NULL THEN NULL
      ELSE NEW.plano2_inicio + interval '1 month'
    END;

  ELSIF NEW.plano2_meses_contrato IS DISTINCT FROM OLD.plano2_meses_contrato THEN
    NEW.plano2_contrato_fim := CASE
      WHEN NEW.plano2_inicio IS NULL THEN NULL
      ELSE NEW.plano2_inicio + (NEW.plano2_meses_contrato * interval '1 month')
    END;
  END IF;

  -- ── BÔNUS ───────────────────────────────────────────────────
  IF TG_OP='INSERT' OR NEW.bonus_id IS DISTINCT FROM OLD.bonus_id THEN
    IF NEW.bonus_id IS NULL THEN
      NEW.bonus_imgs_limite     := 0; NEW.bonus_renders_limite   := 0; NEW.bonus_geracoes_limite  := 0;
      NEW.bonus_imgs_usadas     := 0; NEW.bonus_renders_usados   := 0; NEW.bonus_geracoes_usadas  := 0;
      NEW.bonus_inicio          := NULL;
      NEW.bonus_expira_em       := NULL;
      NEW.bonus_contrato_fim    := NULL;
      NEW.bonus_meses_contrato  := 1;
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
      NEW.bonus_contrato_fim    := now() + (NEW.bonus_meses_contrato * interval '1 month');
    END IF;
    NEW.extra_b_estatico := 0; NEW.extra_b_carrossel := 0;
    NEW.extra_b_estatico_final := 0; NEW.extra_b_reels := 0;

  ELSIF NEW.bonus_inicio IS DISTINCT FROM OLD.bonus_inicio THEN
    NEW.bonus_expira_em := CASE
      WHEN NEW.bonus_inicio IS NULL THEN NULL
      ELSE NEW.bonus_inicio + interval '1 month'
    END;

  ELSIF NEW.bonus_meses_contrato IS DISTINCT FROM OLD.bonus_meses_contrato THEN
    NEW.bonus_contrato_fim := CASE
      WHEN NEW.bonus_inicio IS NULL THEN NULL
      ELSE NEW.bonus_inicio + (NEW.bonus_meses_contrato * interval '1 month')
    END;
  END IF;

  RETURN NEW;
END $function$;

-- 4. pg_cron: auto-renova ciclos de contratos multi-mês
-- Roda todo dia às 03:00 (America/Sao_Paulo = UTC-3, ou seja, 06:00 UTC)
SELECT cron.schedule(
  'auto-renova-ciclos',
  '0 6 * * *',
  $$
    -- Plano 1
    UPDATE public.profiles SET
      plano1_inicio         = plano1_expira_em,
      plano1_imgs_usadas    = 0,
      plano1_renders_usados  = 0,
      plano1_geracoes_usadas = 0
    WHERE plano1_id IS NOT NULL
      AND plano1_expira_em  IS NOT NULL
      AND plano1_expira_em  <= now()
      AND plano1_contrato_fim IS NOT NULL
      AND plano1_contrato_fim > now()
      AND plano1_meses_contrato > 1;

    -- Plano 2
    UPDATE public.profiles SET
      plano2_inicio         = plano2_expira_em,
      plano2_imgs_usadas    = 0,
      plano2_renders_usados  = 0,
      plano2_geracoes_usadas = 0
    WHERE plano2_id IS NOT NULL
      AND plano2_expira_em  IS NOT NULL
      AND plano2_expira_em  <= now()
      AND plano2_contrato_fim IS NOT NULL
      AND plano2_contrato_fim > now()
      AND plano2_meses_contrato > 1;

    -- Bônus
    UPDATE public.profiles SET
      bonus_inicio         = bonus_expira_em,
      bonus_imgs_usadas    = 0,
      bonus_renders_usados  = 0,
      bonus_geracoes_usadas = 0
    WHERE bonus_id IS NOT NULL
      AND bonus_expira_em  IS NOT NULL
      AND bonus_expira_em  <= now()
      AND bonus_contrato_fim IS NOT NULL
      AND bonus_contrato_fim > now()
      AND bonus_meses_contrato > 1;
  $$
);
