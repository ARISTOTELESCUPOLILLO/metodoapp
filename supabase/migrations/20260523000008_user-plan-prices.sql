-- Preço aplicado por usuário em cada slot de plano (em R$)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plano1_preco_brl NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS plano2_preco_brl NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bonus_preco_brl  NUMERIC DEFAULT NULL;
