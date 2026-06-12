-- Adiciona coluna secondary_font na tabela brand_kits
-- Campo opcional: tipografia manuscrita secundária ('fina' | 'grossa') para
-- destacar 1 palavra-chave do título com cor de destaque.
ALTER TABLE brand_kits
  ADD COLUMN IF NOT EXISTS secondary_font TEXT NULL;
