-- Fim do CONTRATO deixa de depender de nao ter mexido na data de inicio
--
-- DEFEITO (achado em 19/08/2026 na conta MOTO VALE): apply_slot_limits tratava
-- "trocou de plano", "mudou a data de inicio" e "mudou a duracao do contrato"
-- como tres alternativas EXCLUDENTES (IF / ELSIF / ELSIF). Salvar um ajuste de
-- data junto com a duracao parava no segundo ramo, e o terceiro - o unico que
-- refaz plano*_contrato_fim - nunca rodava. O cadastro ficava dizendo "3 meses"
-- com data-fim de 1 mes, e como a renovacao automatica exige contrato_fim no
-- futuro, o ciclo mensal do cliente parava de renovar em silencio.
--
-- CORRECAO: os dois recalculos passam a ser checagens independentes dentro do
-- mesmo ELSE. Nada mais muda - a troca de plano continua refazendo tudo, e o
-- contrato NAO acompanha o inicio quando so o inicio muda (senao a renovacao
-- automatica, que empurra o inicio todo mes, esticaria o contrato para sempre).
--
-- Arquivo em ASCII de proposito: acento literal chega corrompido pelo canal de
-- escrita usado para aplicar isto (ver reference-supabase-escrita-daqui-encoding).
-- A unica mensagem acentuada da funcao esta preservada por escape Unicode.

CREATE OR REPLACE FUNCTION public.apply_slot_limits()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_li INT; v_lr INT; v_lg INT; v_lrt INT; v_lsg INT; v_lpg INT; v_bonus BOOLEAN;
BEGIN

  -- -- PLANO 1 -------------------------------------------------
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

  ELSE
    -- CICLO mensal: o inicio muda na renovacao automatica (cron) e quando o
    -- admin corrige a data. Nos dois casos so o fim do CICLO se refaz.
    IF NEW.plano1_inicio IS DISTINCT FROM OLD.plano1_inicio THEN
      NEW.plano1_expira_em := CASE
        WHEN NEW.plano1_inicio IS NULL THEN NULL
        ELSE NEW.plano1_inicio + interval '1 month'
      END;
    END IF;

    -- CONTRATO: a duracao mudou, entao o fim do contrato se refaz a partir do
    -- inicio VIGENTE (o novo, se ele mudou no mesmo salvamento).
    -- DEIXOU DE SER ELSIF EM 19/08/2026: as duas checagens eram alternativas
    -- excludentes, e mudar a data de inicio consumia o ELSIF antes de o
    -- recalculo do contrato acontecer. Um contrato de 3 meses salvo junto com
    -- um ajuste de data continuava terminando em 1 mes, sem aviso nenhum
    -- (conta MOTO VALE, slot plano2: 3 meses gravados, fim em 15/08 em vez de
    -- 19/10, ciclo mensal parado de renovar em 15/08).
    IF NEW.plano1_meses_contrato IS DISTINCT FROM OLD.plano1_meses_contrato THEN
      NEW.plano1_contrato_fim := CASE
        WHEN NEW.plano1_inicio IS NULL THEN NULL
        ELSE NEW.plano1_inicio + (NEW.plano1_meses_contrato * interval '1 month')
      END;
    END IF;
  END IF;

  -- -- PLANO 2 -------------------------------------------------
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

  ELSE
    -- CICLO mensal (mesma regra do plano 1).
    IF NEW.plano2_inicio IS DISTINCT FROM OLD.plano2_inicio THEN
      NEW.plano2_expira_em := CASE
        WHEN NEW.plano2_inicio IS NULL THEN NULL
        ELSE NEW.plano2_inicio + interval '1 month'
      END;
    END IF;

    -- CONTRATO (mesma regra do plano 1 - ver o comentario la em cima).
    IF NEW.plano2_meses_contrato IS DISTINCT FROM OLD.plano2_meses_contrato THEN
      NEW.plano2_contrato_fim := CASE
        WHEN NEW.plano2_inicio IS NULL THEN NULL
        ELSE NEW.plano2_inicio + (NEW.plano2_meses_contrato * interval '1 month')
      END;
    END IF;
  END IF;

  -- -- BONUS ---------------------------------------------------
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
        RAISE EXCEPTION U&'Plano selecionado n\00E3o \00E9 eleg\00EDvel para b\00F4nus';
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

  ELSE
    -- CICLO mensal (mesma regra do plano 1).
    IF NEW.bonus_inicio IS DISTINCT FROM OLD.bonus_inicio THEN
      NEW.bonus_expira_em := CASE
        WHEN NEW.bonus_inicio IS NULL THEN NULL
        ELSE NEW.bonus_inicio + interval '1 month'
      END;
    END IF;

    -- CONTRATO (mesma regra do plano 1 - ver o comentario la em cima).
    IF NEW.bonus_meses_contrato IS DISTINCT FROM OLD.bonus_meses_contrato THEN
      NEW.bonus_contrato_fim := CASE
        WHEN NEW.bonus_inicio IS NULL THEN NULL
        ELSE NEW.bonus_inicio + (NEW.bonus_meses_contrato * interval '1 month')
      END;
    END IF;
  END IF;

  RETURN NEW;
END $function$
