-- Adiciona colunas de faixa de preço por plano (mínimo e médio)
-- preco_maximo_brl já existe; aqui completamos os três níveis da tabela de preços.
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS preco_minimo_brl NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preco_medio_brl  NUMERIC DEFAULT 0;
