-- Aposenta o contador legado "Gerações" do bloqueio/financeiro dos planos PU
-- e corrige um bug de produção já ativo: o cron de renovação de ciclo nunca
-- zerava os 3 contadores novos (regen_texto/sugestoes/primeira_geracao).
--
-- Contexto (auditoria Opus 4.8 + revisão crítica Fable, 2026-07-03):
-- - No MOP, limite_geracoes já é 0 (ilimitado) desde 20260606000001 — sem
--   efeito ali. A mudança real é só nos planos PU (PU2/PU4/PU8), onde
--   "Primeira Geração" já esgota antes de "Gerações" na prática (16 vs 60 no
--   PU8) — ou seja, o teto efetivo já É Primeira Geração, só o financeiro
--   ainda projeta em cima de Gerações (double-count corrigido de graça ao
--   zerar, sem tocar em costs.ts — planExtrasMonthlyCost já precifica
--   Primeira Geração corretamente).
-- - O gate (checkBalance/debit_usage) lê as CÓPIAS em profiles, não a tabela
--   plans — zerar só plans não muda nada pra quem já tem plano atribuído.
--   Por isso esta migration zera as duas.
-- - Bug do cron: já afeta produção HOJE, independente desta mudança —
--   qualquer contrato multi-mês (meses_contrato > 1) carrega o consumo de
--   Sugestão/Gerar outro/Primeira Geração pro mês seguinte sem zerar.

-- ============================================================
-- 1. Corrige o cron auto-renova-ciclos (bug já ativo em produção)
-- ============================================================
SELECT cron.unschedule('auto-renova-ciclos');

SELECT cron.schedule(
  'auto-renova-ciclos',
  '0 6 * * *',
  $$
    -- Plano 1
    UPDATE public.profiles SET
      plano1_inicio                  = plano1_expira_em,
      plano1_imgs_usadas             = 0,
      plano1_renders_usados          = 0,
      plano1_geracoes_usadas         = 0,
      plano1_regen_texto_usadas      = 0,
      plano1_sugestoes_usadas        = 0,
      plano1_primeira_geracao_usadas = 0
    WHERE plano1_id IS NOT NULL
      AND plano1_expira_em  IS NOT NULL
      AND plano1_expira_em  <= now()
      AND plano1_contrato_fim IS NOT NULL
      AND plano1_contrato_fim > now()
      AND plano1_meses_contrato > 1;

    -- Plano 2
    UPDATE public.profiles SET
      plano2_inicio                  = plano2_expira_em,
      plano2_imgs_usadas             = 0,
      plano2_renders_usados          = 0,
      plano2_geracoes_usadas         = 0,
      plano2_regen_texto_usadas      = 0,
      plano2_sugestoes_usadas        = 0,
      plano2_primeira_geracao_usadas = 0
    WHERE plano2_id IS NOT NULL
      AND plano2_expira_em  IS NOT NULL
      AND plano2_expira_em  <= now()
      AND plano2_contrato_fim IS NOT NULL
      AND plano2_contrato_fim > now()
      AND plano2_meses_contrato > 1;

    -- Bônus
    UPDATE public.profiles SET
      bonus_inicio                  = bonus_expira_em,
      bonus_imgs_usadas             = 0,
      bonus_renders_usados          = 0,
      bonus_geracoes_usadas         = 0,
      bonus_regen_texto_usadas      = 0,
      bonus_sugestoes_usadas        = 0,
      bonus_primeira_geracao_usadas = 0
    WHERE bonus_id IS NOT NULL
      AND bonus_expira_em  IS NOT NULL
      AND bonus_expira_em  <= now()
      AND bonus_contrato_fim IS NOT NULL
      AND bonus_contrato_fim > now()
      AND bonus_meses_contrato > 1;
  $$
);

-- ============================================================
-- 2. Zera limite_geracoes dos planos PU (tabela plans)
--    "Primeira Geração" já é o teto real; geracoes vira campo morto
--    (débito mantido nos endpoints só para rate-limit/rastreio de log).
-- ============================================================
UPDATE public.plans SET limite_geracoes = 0 WHERE codigo IN ('PU2', 'PU4', 'PU8');

-- ============================================================
-- 3. Espelha em profiles (as cópias que o gate de fato lê) —
--    plano1/plano2/bonus, para quem já tem esses planos atribuídos.
-- ============================================================
UPDATE public.profiles SET plano1_geracoes_limite = 0
  WHERE plano1_id IN (SELECT id FROM public.plans WHERE codigo IN ('PU2', 'PU4', 'PU8'));
UPDATE public.profiles SET plano2_geracoes_limite = 0
  WHERE plano2_id IN (SELECT id FROM public.plans WHERE codigo IN ('PU2', 'PU4', 'PU8'));
UPDATE public.profiles SET bonus_geracoes_limite = 0
  WHERE bonus_id IN (SELECT id FROM public.plans WHERE codigo IN ('PU2', 'PU4', 'PU8'));
