-- Rastreia qual admin atuou como outro usuário durante uma geração.
-- Quando um admin impersona um teste, user_id = admin, impersonated_by = teste.
ALTER TABLE public.usage_logs
  ADD COLUMN IF NOT EXISTS impersonated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.usage_logs.impersonated_by IS
  'ID do usuário-teste que estava sendo impersonado pelo admin no momento da geração';
