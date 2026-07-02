-- ============================================================
-- 3º contador adicional: "Primeira Geração" (título+texto[+legenda] gerados
-- pela PRIMEIRA VEZ ao criar a peça — diferente de "Nova Geração"
-- (regen_texto), que é o clique manual "Gerar outro" depois).
--
-- Hierarquia de bloqueio do plano (confirmada pelo dono do produto):
--   1. IMAGENS — limite PRINCIPAL, já existia, não muda.
--   2. TEMPO — ciclo de 30 dias / expiração do plano, já existia, não muda.
--   3. "Fases" (Sugestão, Primeira Geração, Nova Geração) — camadas
--      ADICIONAIS por cima, não precisam ser matematicamente perfeitas.
--
-- Esta migration também CORRIGE os valores de limite_sugestoes/
-- limite_regen_texto semeados em 20260702000001 conforme a tabela final
-- revisada pelo dono do produto (só S9V/S9C mudaram de fato: regen_texto
-- 80→100; os demais são reafirmados, UPDATE idempotente em todos os 10).
-- ============================================================

-- 1. Nova coluna em plans
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS limite_primeira_geracao INT NOT NULL DEFAULT 0;

-- 2. Novas colunas em profiles (3 slots × limite/usadas)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plano1_primeira_geracao_limite INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plano1_primeira_geracao_usadas INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plano2_primeira_geracao_limite INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plano2_primeira_geracao_usadas INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_primeira_geracao_limite  INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_primeira_geracao_usadas  INT NOT NULL DEFAULT 0;

-- 3. Valores finais por plano (código → sugestoes, primeira_geracao, regen_texto)
--    UPDATE idempotente em todos os 10 — reafirma os que já estavam certos e
--    corrige o único que mudou de fato (S9V/S9C regen_texto: 80 → 100).
UPDATE public.plans SET limite_sugestoes = 24, limite_primeira_geracao = 40, limite_regen_texto = 150 WHERE codigo = 'S3V';
UPDATE public.plans SET limite_sugestoes = 24, limite_primeira_geracao = 40, limite_regen_texto = 150 WHERE codigo = 'S3C';
UPDATE public.plans SET limite_sugestoes = 24, limite_primeira_geracao = 80, limite_regen_texto = 300 WHERE codigo = 'S6V';
UPDATE public.plans SET limite_sugestoes = 24, limite_primeira_geracao = 80, limite_regen_texto = 300 WHERE codigo = 'S6C';
UPDATE public.plans SET limite_sugestoes = 12, limite_primeira_geracao = 60, limite_regen_texto = 100 WHERE codigo = 'S9V';
UPDATE public.plans SET limite_sugestoes = 12, limite_primeira_geracao = 60, limite_regen_texto = 100 WHERE codigo = 'S9C';
UPDATE public.plans SET limite_sugestoes = 6,  limite_primeira_geracao = 14, limite_regen_texto = 40  WHERE codigo = 'EX01';
UPDATE public.plans SET limite_sugestoes = 40, limite_primeira_geracao = 16, limite_regen_texto = 40  WHERE codigo = 'PU8';
UPDATE public.plans SET limite_sugestoes = 20, limite_primeira_geracao = 8,  limite_regen_texto = 20  WHERE codigo = 'PU4';
UPDATE public.plans SET limite_sugestoes = 10, limite_primeira_geracao = 5,  limite_regen_texto = 10  WHERE codigo = 'PU2';

-- 4. Backfill em profiles — limite_primeira_geracao (novo) + reaplica os
--    valores corrigidos de sugestoes/regen_texto pros 2 contadores já
--    existentes (mesma lógica de 20260702000001, repetida pq os valores de
--    plans mudaram no passo 3 acima). *_usadas ficam como estão — regenerações
--    passadas não retroagem.
UPDATE public.profiles p SET
  plano1_primeira_geracao_limite = COALESCE((SELECT limite_primeira_geracao FROM public.plans WHERE id = p.plano1_id), 0),
  plano1_regen_texto_limite      = COALESCE((SELECT limite_regen_texto      FROM public.plans WHERE id = p.plano1_id), 0),
  plano1_sugestoes_limite        = COALESCE((SELECT limite_sugestoes        FROM public.plans WHERE id = p.plano1_id), 0)
WHERE p.plano1_id IS NOT NULL;

UPDATE public.profiles p SET
  plano2_primeira_geracao_limite = COALESCE((SELECT limite_primeira_geracao FROM public.plans WHERE id = p.plano2_id), 0),
  plano2_regen_texto_limite      = COALESCE((SELECT limite_regen_texto      FROM public.plans WHERE id = p.plano2_id), 0),
  plano2_sugestoes_limite        = COALESCE((SELECT limite_sugestoes        FROM public.plans WHERE id = p.plano2_id), 0)
WHERE p.plano2_id IS NOT NULL;

UPDATE public.profiles p SET
  bonus_primeira_geracao_limite = COALESCE((SELECT limite_primeira_geracao FROM public.plans WHERE id = p.bonus_id), 0),
  bonus_regen_texto_limite      = COALESCE((SELECT limite_regen_texto      FROM public.plans WHERE id = p.bonus_id), 0),
  bonus_sugestoes_limite        = COALESCE((SELECT limite_sugestoes        FROM public.plans WHERE id = p.bonus_id), 0)
WHERE p.bonus_id IS NOT NULL;

-- 5. Recria apply_slot_limits INCLUINDO limite_primeira_geracao nos 3 blocos
--    (base: versão de 20260702000001, que já tinha regen_texto/sugestoes).
CREATE OR REPLACE FUNCTION public.apply_slot_limits()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_li INT; v_lr INT; v_lg INT; v_lrt INT; v_lsg INT; v_lpg INT; v_bonus BOOLEAN;
BEGIN

  -- ── PLANO 1 ─────────────────────────────────────────────────
  IF TG_OP='INSERT' OR NEW.plano1_id IS DISTINCT FROM OLD.plano1_id THEN
    IF NEW.plano1_id IS NULL THEN
      NEW.plano1_imgs_limite     := 0; NEW.plano1_renders_limite   := 0; NEW.plano1_geracoes_limite  := 0;
      NEW.plano1_imgs_usadas     := 0; NEW.plano1_renders_usados   := 0; NEW.plano1_geracoes_usadas  := 0;
      NEW.plano1_regen_texto_limite := 0; NEW.plano1_regen_texto_usadas := 0;
      NEW.plano1_sugestoes_limite   := 0; NEW.plano1_sugestoes_usadas   := 0;
      NEW.plano1_primeira_geracao_limite := 0; NEW.plano1_primeira_geracao_usadas := 0;
      NEW.plano1_inicio          := NULL;
      NEW.plano1_expira_em       := NULL;
      NEW.plano1_contrato_fim    := NULL;
      NEW.plano1_meses_contrato  := 1;
    ELSE
      SELECT limite_imagens, limite_renders, limite_geracoes, limite_regen_texto, limite_sugestoes, limite_primeira_geracao
        INTO v_li, v_lr, v_lg, v_lrt, v_lsg, v_lpg FROM public.plans WHERE id = NEW.plano1_id;
      NEW.plano1_imgs_limite     := COALESCE(v_li, 0);
      NEW.plano1_renders_limite  := COALESCE(v_lr, 0);
      NEW.plano1_geracoes_limite := COALESCE(v_lg, 0);
      NEW.plano1_regen_texto_limite := COALESCE(v_lrt, 0);
      NEW.plano1_sugestoes_limite   := COALESCE(v_lsg, 0);
      NEW.plano1_primeira_geracao_limite := COALESCE(v_lpg, 0);
      NEW.plano1_imgs_usadas     := 0; NEW.plano1_renders_usados   := 0; NEW.plano1_geracoes_usadas  := 0;
      NEW.plano1_regen_texto_usadas := 0; NEW.plano1_sugestoes_usadas := 0;
      NEW.plano1_primeira_geracao_usadas := 0;
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
      NEW.plano2_primeira_geracao_limite := 0; NEW.plano2_primeira_geracao_usadas := 0;
      NEW.plano2_inicio          := NULL;
      NEW.plano2_expira_em       := NULL;
      NEW.plano2_contrato_fim    := NULL;
      NEW.plano2_meses_contrato  := 1;
    ELSE
      SELECT limite_imagens, limite_renders, limite_geracoes, limite_regen_texto, limite_sugestoes, limite_primeira_geracao
        INTO v_li, v_lr, v_lg, v_lrt, v_lsg, v_lpg FROM public.plans WHERE id = NEW.plano2_id;
      NEW.plano2_imgs_limite     := COALESCE(v_li, 0);
      NEW.plano2_renders_limite  := COALESCE(v_lr, 0);
      NEW.plano2_geracoes_limite := COALESCE(v_lg, 0);
      NEW.plano2_regen_texto_limite := COALESCE(v_lrt, 0);
      NEW.plano2_sugestoes_limite   := COALESCE(v_lsg, 0);
      NEW.plano2_primeira_geracao_limite := COALESCE(v_lpg, 0);
      NEW.plano2_imgs_usadas     := 0; NEW.plano2_renders_usados   := 0; NEW.plano2_geracoes_usadas  := 0;
      NEW.plano2_regen_texto_usadas := 0; NEW.plano2_sugestoes_usadas := 0;
      NEW.plano2_primeira_geracao_usadas := 0;
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
      NEW.bonus_primeira_geracao_limite := 0; NEW.bonus_primeira_geracao_usadas := 0;
      NEW.bonus_inicio          := NULL;
      NEW.bonus_expira_em       := NULL;
      NEW.bonus_contrato_fim    := NULL;
      NEW.bonus_meses_contrato  := 1;
    ELSE
      SELECT limite_imagens, limite_renders, limite_geracoes, limite_regen_texto, limite_sugestoes, limite_primeira_geracao, elegivel_bonus
        INTO v_li, v_lr, v_lg, v_lrt, v_lsg, v_lpg, v_bonus FROM public.plans WHERE id = NEW.bonus_id;
      IF NOT COALESCE(v_bonus, false) THEN
        RAISE EXCEPTION 'Plano selecionado não é elegível para bônus';
      END IF;
      NEW.bonus_imgs_limite     := COALESCE(v_li, 0);
      NEW.bonus_renders_limite  := COALESCE(v_lr, 0);
      NEW.bonus_geracoes_limite := COALESCE(v_lg, 0);
      NEW.bonus_regen_texto_limite := COALESCE(v_lrt, 0);
      NEW.bonus_sugestoes_limite   := COALESCE(v_lsg, 0);
      NEW.bonus_primeira_geracao_limite := COALESCE(v_lpg, 0);
      NEW.bonus_imgs_usadas     := 0; NEW.bonus_renders_usados   := 0; NEW.bonus_geracoes_usadas  := 0;
      NEW.bonus_regen_texto_usadas := 0; NEW.bonus_sugestoes_usadas := 0;
      NEW.bonus_primeira_geracao_usadas := 0;
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
