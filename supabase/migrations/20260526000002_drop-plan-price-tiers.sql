-- Remove colunas desnecessárias: preço mín. é calculado (custo×3) e preço méd. é computado dos perfis
ALTER TABLE public.plans
  DROP COLUMN IF EXISTS preco_minimo_brl,
  DROP COLUMN IF EXISTS preco_medio_brl;
