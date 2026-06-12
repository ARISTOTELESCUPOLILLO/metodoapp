-- Adiciona coluna products na tabela brand_kits
-- Lista de produtos, serviços, categorias ou especialidades reais da empresa/marca
-- (mínimo 3, máximo 10) — usada para ancorar a Sugestão (Informação-chave) em
-- algo concreto, em vez de depender só da descrição livre da atividade.
ALTER TABLE brand_kits
  ADD COLUMN IF NOT EXISTS products JSONB NOT NULL DEFAULT '[]'::jsonb;
