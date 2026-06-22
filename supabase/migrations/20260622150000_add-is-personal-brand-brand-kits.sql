-- Adiciona coluna is_personal_brand na tabela brand_kits
-- Marca pessoal (segmento MARCA): o dono/profissional É a marca (artista,
-- terapeuta, coach, influenciador) — ver documento de princípios, Parte 2.1.
ALTER TABLE brand_kits
  ADD COLUMN IF NOT EXISTS is_personal_brand BOOLEAN NOT NULL DEFAULT false;
