-- Adiciona coluna uniforme_url na tabela brand_kits
-- Foto do uniforme da empresa (plano médio, sem rosto) — referência de
-- cor/modelo/posição da logo usada ao gerar peças com "Gerar com uniforme".
ALTER TABLE brand_kits
  ADD COLUMN IF NOT EXISTS uniforme_url TEXT;
