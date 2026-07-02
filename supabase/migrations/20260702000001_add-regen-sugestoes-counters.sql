-- ============================================================
-- Contadores de "Gerar outro" de bloco (regen_texto) e "Sugestão"
-- (sugestoes) por plano e por slot.
--
-- Até aqui os botões "Gerar outro" (regenerate-block) e "Sugestão"
-- (suggest-keyinfo) gastavam OpenAI sem cota nenhuma — só exigiam plano
-- atribuído. Esta migration cria os limites reais:
--   * plans.limite_regen_texto / limite_sugestoes  → limite por plano
--   * profiles.planoN_regen_texto_limite/usadas    → cópia + consumo por slot
--   * profiles.planoN_sugestoes_limite/usadas       (mesmo padrão dos demais
--     contadores: imgs/renders/geracoes)
-- Convenção mantida: limite = 0 significa ILIMITADO (igual imgs/renders/geracoes).
-- ============================================================

-- 1. Novas colunas em plans
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS limite_regen_texto INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS limite_sugestoes   INT NOT NULL DEFAULT 0;

-- 2. Novas colunas em profiles (3 slots × 2 contadores × limite/usadas)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plano1_regen_texto_limite INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plano1_regen_texto_usadas INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plano2_regen_texto_limite INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plano2_regen_texto_usadas INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_regen_texto_limite  INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_regen_texto_usadas  INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plano1_sugestoes_limite   INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plano1_sugestoes_usadas   INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plano2_sugestoes_limite   INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plano2_sugestoes_usadas   INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_sugestoes_limite    INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_sugestoes_usadas    INT NOT NULL DEFAULT 0;

-- 3. Valores oficiais por plano (código → limite_regen_texto, limite_sugestoes)
UPDATE public.plans SET limite_regen_texto = 150, limite_sugestoes = 24 WHERE codigo = 'S3V';
UPDATE public.plans SET limite_regen_texto = 150, limite_sugestoes = 24 WHERE codigo = 'S3C';
UPDATE public.plans SET limite_regen_texto = 300, limite_sugestoes = 24 WHERE codigo = 'S6V';
UPDATE public.plans SET limite_regen_texto = 300, limite_sugestoes = 24 WHERE codigo = 'S6C';
UPDATE public.plans SET limite_regen_texto = 80,  limite_sugestoes = 12 WHERE codigo = 'S9V';
UPDATE public.plans SET limite_regen_texto = 80,  limite_sugestoes = 12 WHERE codigo = 'S9C';
UPDATE public.plans SET limite_regen_texto = 40,  limite_sugestoes = 6  WHERE codigo = 'EX01';
UPDATE public.plans SET limite_regen_texto = 40,  limite_sugestoes = 40 WHERE codigo = 'PU8';
UPDATE public.plans SET limite_regen_texto = 20,  limite_sugestoes = 20 WHERE codigo = 'PU4';
UPDATE public.plans SET limite_regen_texto = 10,  limite_sugestoes = 10 WHERE codigo = 'PU2';

-- 4. Backfill dos limites nos perfis já existentes (por slot).
--    *_usadas ficam em 0 — regenerações/sugestões passadas não retroagem.
UPDATE public.profiles p SET
  plano1_regen_texto_limite = COALESCE((SELECT limite_regen_texto FROM public.plans WHERE id = p.plano1_id), 0),
  plano1_sugestoes_limite   = COALESCE((SELECT limite_sugestoes   FROM public.plans WHERE id = p.plano1_id), 0)
WHERE p.plano1_id IS NOT NULL;

UPDATE public.profiles p SET
  plano2_regen_texto_limite = COALESCE((SELECT limite_regen_texto FROM public.plans WHERE id = p.plano2_id), 0),
  plano2_sugestoes_limite   = COALESCE((SELECT limite_sugestoes   FROM public.plans WHERE id = p.plano2_id), 0)
WHERE p.plano2_id IS NOT NULL;

UPDATE public.profiles p SET
  bonus_regen_texto_limite = COALESCE((SELECT limite_regen_texto FROM public.plans WHERE id = p.bonus_id), 0),
  bonus_sugestoes_limite   = COALESCE((SELECT limite_sugestoes   FROM public.plans WHERE id = p.bonus_id), 0)
WHERE p.bonus_id IS NOT NULL;

-- 5. Recria apply_slot_limits INCLUINDO os 2 novos contadores nos 3 blocos.
--    Base: versão de 20260603000001_contrato-meses.sql (meses_contrato +
--    contrato_fim). Sem essa recriação, todo plano atribuído no futuro
--    nasceria com limite 0 (= ilimitado) nos campos novos, silenciosamente.
CREATE OR REPLACE FUNCTION public.apply_slot_limits()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_li INT; v_lr INT; v_lg INT; v_lrt INT; v_lsg INT; v_bonus BOOLEAN;
BEGIN

  -- ── PLANO 1 ─────────────────────────────────────────────────
  IF TG_OP='INSERT' OR NEW.plano1_id IS DISTINCT FROM OLD.plano1_id THEN
    IF NEW.plano1_id IS NULL THEN
      NEW.plano1_imgs_limite     := 0; NEW.plano1_renders_limite   := 0; NEW.plano1_geracoes_limite  := 0;
      NEW.plano1_imgs_usadas     := 0; NEW.plano1_renders_usados   := 0; NEW.plano1_geracoes_usadas  := 0;
      NEW.plano1_regen_texto_limite := 0; NEW.plano1_regen_texto_usadas := 0;
      NEW.plano1_sugestoes_limite   := 0; NEW.plano1_sugestoes_usadas   := 0;
      NEW.plano1_inicio          := NULL;
      NEW.plano1_expira_em       := NULL;
      NEW.plano1_contrato_fim    := NULL;
      NEW.plano1_meses_contrato  := 1;
    ELSE
      SELECT limite_imagens, limite_renders, limite_geracoes, limite_regen_texto, limite_sugestoes
        INTO v_li, v_lr, v_lg, v_lrt, v_lsg FROM public.plans WHERE id = NEW.plano1_id;
      NEW.plano1_imgs_limite     := COALESCE(v_li, 0);
      NEW.plano1_renders_limite  := COALESCE(v_lr, 0);
      NEW.plano1_geracoes_limite := COALESCE(v_lg, 0);
      NEW.plano1_regen_texto_limite := COALESCE(v_lrt, 0);
      NEW.plano1_sugestoes_limite   := COALESCE(v_lsg, 0);
      NEW.plano1_imgs_usadas     := 0; NEW.plano1_renders_usados   := 0; NEW.plano1_geracoes_usadas  := 0;
      NEW.plano1_regen_texto_usadas := 0; NEW.plano1_sugestoes_usadas := 0;
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
      NEW.plano2_regen_texto_limite := 0; NEW.plano2_regen_texto_usadas := 0;
      NEW.plano2_sugestoes_limite   := 0; NEW.plano2_sugestoes_usadas   := 0;
      NEW.plano2_inicio          := NULL;
      NEW.plano2_expira_em       := NULL;
      NEW.plano2_contrato_fim    := NULL;
      NEW.plano2_meses_contrato  := 1;
    ELSE
      SELECT limite_imagens, limite_renders, limite_geracoes, limite_regen_texto, limite_sugestoes
        INTO v_li, v_lr, v_lg, v_lrt, v_lsg FROM public.plans WHERE id = NEW.plano2_id;
      NEW.plano2_imgs_limite     := COALESCE(v_li, 0);
      NEW.plano2_renders_limite  := COALESCE(v_lr, 0);
      NEW.plano2_geracoes_limite := COALESCE(v_lg, 0);
      NEW.plano2_regen_texto_limite := COALESCE(v_lrt, 0);
      NEW.plano2_sugestoes_limite   := COALESCE(v_lsg, 0);
      NEW.plano2_imgs_usadas     := 0; NEW.plano2_renders_usados   := 0; NEW.plano2_geracoes_usadas  := 0;
      NEW.plano2_regen_texto_usadas := 0; NEW.plano2_sugestoes_usadas := 0;
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
      NEW.bonus_regen_texto_limite := 0; NEW.bonus_regen_texto_usadas := 0;
      NEW.bonus_sugestoes_limite   := 0; NEW.bonus_sugestoes_usadas   := 0;
      NEW.bonus_inicio          := NULL;
      NEW.bonus_expira_em       := NULL;
      NEW.bonus_contrato_fim    := NULL;
      NEW.bonus_meses_contrato  := 1;
    ELSE
      SELECT limite_imagens, limite_renders, limite_geracoes, limite_regen_texto, limite_sugestoes, elegivel_bonus
        INTO v_li, v_lr, v_lg, v_lrt, v_lsg, v_bonus FROM public.plans WHERE id = NEW.bonus_id;
      IF NOT COALESCE(v_bonus, false) THEN
        RAISE EXCEPTION 'Plano selecionado não é elegível para bônus';
      END IF;
      NEW.bonus_imgs_limite     := COALESCE(v_li, 0);
      NEW.bonus_renders_limite  := COALESCE(v_lr, 0);
      NEW.bonus_geracoes_limite := COALESCE(v_lg, 0);
      NEW.bonus_regen_texto_limite := COALESCE(v_lrt, 0);
      NEW.bonus_sugestoes_limite   := COALESCE(v_lsg, 0);
      NEW.bonus_imgs_usadas     := 0; NEW.bonus_renders_usados   := 0; NEW.bonus_geracoes_usadas  := 0;
      NEW.bonus_regen_texto_usadas := 0; NEW.bonus_sugestoes_usadas := 0;
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
