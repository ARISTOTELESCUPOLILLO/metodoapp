-- Planos MOP limitados apenas por imagens (e renders para cinemática).
-- O contador de gerações continua sendo registrado para rastreio de custo,
-- mas não bloqueia o uso — limite_geracoes = 0 significa ilimitado na função fits().
--
-- Planos afetados: EX01, S3C, S3V, S6C, S6V, S9C, S9V
-- Planos PU (PU2, PU4, PU8) mantêm limite_geracoes para controle de texto.

-- 1. Tabela plans: zerar limite_geracoes para todos os planos MOP
UPDATE public.plans
SET limite_geracoes = 0
WHERE codigo IN ('EX01', 'S3C', 'S3V', 'S6C', 'S6V', 'S9C', 'S9V');

-- 2. Profiles com plano MOP no slot P1
UPDATE public.profiles
SET plano1_geracoes_limite = 0
WHERE plano1_id IN (
  SELECT id FROM public.plans WHERE codigo IN ('EX01', 'S3C', 'S3V', 'S6C', 'S6V', 'S9C', 'S9V')
);

-- 3. Profiles com plano MOP no slot P2
UPDATE public.profiles
SET plano2_geracoes_limite = 0
WHERE plano2_id IN (
  SELECT id FROM public.plans WHERE codigo IN ('EX01', 'S3C', 'S3V', 'S6C', 'S6V', 'S9C', 'S9V')
);

-- 4. Profiles com plano MOP no slot Bônus
UPDATE public.profiles
SET bonus_geracoes_limite = 0
WHERE bonus_id IN (
  SELECT id FROM public.plans WHERE codigo IN ('EX01', 'S3C', 'S3V', 'S6C', 'S6V', 'S9C', 'S9V')
);
