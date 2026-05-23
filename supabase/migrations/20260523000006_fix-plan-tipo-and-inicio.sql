-- 1. Garante tipo correto nos planos sequência e posts
UPDATE public.plans SET tipo = 'mensal' WHERE codigo IN ('S3V','S6V','S9V','S3C','S6C','S9C');
UPDATE public.plans SET tipo = 'post'   WHERE codigo IN ('EX01','PU2','PU4','PU8');

-- 2. Preenche plano1_inicio onde está nulo mas o plano já está atribuído
--    (trigger não disparou porque o plano já era o mesmo antes)
UPDATE public.profiles
SET plano1_inicio = now()
WHERE plano1_id IS NOT NULL AND plano1_inicio IS NULL;

-- 3. Idem para plano2 e bonus
UPDATE public.profiles
SET plano2_inicio = now()
WHERE plano2_id IS NOT NULL AND plano2_inicio IS NULL;

UPDATE public.profiles
SET bonus_inicio = now()
WHERE bonus_id IS NOT NULL AND bonus_inicio IS NULL;
