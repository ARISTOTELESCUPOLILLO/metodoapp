-- Dashboard de custos v2: novos campos + planos de usuários + 2 avatares com voz

-- 1. plans: preço máximo editável pelo admin
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS preco_maximo_brl NUMERIC DEFAULT 0;

-- 2. app_settings: saldos das APIs
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS falai_balance_usd NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS openai_balance_usd NUMERIC DEFAULT 0;
UPDATE public.app_settings
  SET falai_balance_usd = 11.27, openai_balance_usd = 8.00
  WHERE id = true;

-- 3. acupolillo@uol.com.br: S3C + PU4, sem bônus
UPDATE public.profiles SET
  plano1_id = (SELECT id FROM public.plans WHERE codigo = 'S3C' LIMIT 1),
  plano2_id = (SELECT id FROM public.plans WHERE codigo = 'PU4' LIMIT 1),
  bonus_id = NULL,
  bonus_inicio = NULL,
  bonus_expira_em = NULL
WHERE email = 'acupolillo@uol.com.br';

-- 4. Teste Top Team: S3V + PU4
UPDATE public.profiles SET
  plano1_id = (SELECT id FROM public.plans WHERE codigo = 'S3V' LIMIT 1),
  plano2_id = (SELECT id FROM public.plans WHERE codigo = 'PU4' LIMIT 1)
WHERE nome = 'Top Team' AND is_test = true;

-- 5. Teste Barbosa Lubrificantes: S3V + PU4
UPDATE public.profiles SET
  plano1_id = (SELECT id FROM public.plans WHERE codigo = 'S3V' LIMIT 1),
  plano2_id = (SELECT id FROM public.plans WHERE codigo = 'PU4' LIMIT 1)
WHERE nome = 'Barbosa Lubrificantes' AND is_test = true;

-- 6. Teste Malhação Sports: só PU4
UPDATE public.profiles SET
  plano1_id = (SELECT id FROM public.plans WHERE codigo = 'PU4' LIMIT 1),
  plano2_id = NULL,
  plano2_inicio = NULL,
  plano2_expira_em = NULL
WHERE nome = 'Malhação Sports' AND is_test = true;

-- 7. voice_clones: permite 2 por usuário (slot 1 = avatar principal, slot 2 = avatar 2)
ALTER TABLE public.voice_clones ADD COLUMN IF NOT EXISTS avatar_slot INT NOT NULL DEFAULT 1;
DROP INDEX IF EXISTS public.voice_clones_user_unique;
CREATE UNIQUE INDEX IF NOT EXISTS voice_clones_user_slot_unique
  ON public.voice_clones (user_id, avatar_slot);

-- 8. user_image_kits: segundo avatar
ALTER TABLE public.user_image_kits ADD COLUMN IF NOT EXISTS avatar_path_2 TEXT;
