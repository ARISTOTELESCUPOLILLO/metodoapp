-- Adiciona coluna assinatura na tabela brand_kits
-- Campo opcional (até 100 caracteres) para assinatura da marca nas legendas
ALTER TABLE brand_kits
  ADD COLUMN IF NOT EXISTS assinatura TEXT NULL;
