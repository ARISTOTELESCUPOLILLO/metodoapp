-- Venda muda de lugar: saiu do Kit de Marca (texto/data URL na coluna) e
-- passa a ser um slot do Kit Imagem (arquivo no bucket "image-kits"), no
-- mesmo padrão de Fato. Nenhuma linha em produção tinha venda_url preenchido
-- (conferido antes desta migração), então não há dado a migrar.
ALTER TABLE public.user_image_kits
  ADD COLUMN IF NOT EXISTS venda_path TEXT;

ALTER TABLE public.brand_kits
  DROP COLUMN IF EXISTS venda_url;
