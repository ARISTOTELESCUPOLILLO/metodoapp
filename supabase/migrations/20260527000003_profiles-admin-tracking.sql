-- Rastreio de qual admin criou cada usuário teste e qual admin atribuiu o bônus
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS bonus_assigned_by UUID REFERENCES auth.users(id);
