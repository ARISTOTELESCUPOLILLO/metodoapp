-- Fato (Kit Imagem) e Venda (Kit de Marca) ganham slot próprio.
-- Fato: fotografia de um acontecimento (visita, confraternização, feira),
-- usada na PU com objetivo "Fatos" — aplicação direta sem reinvenção pela IA.
ALTER TABLE public.user_image_kits
  ADD COLUMN IF NOT EXISTS fato_path TEXT;

-- Venda: fotografia de colaborador com o produto, usada na PU com objetivo
-- "Venda" — mesmo tratamento de preservação do "Fato".
ALTER TABLE public.brand_kits
  ADD COLUMN IF NOT EXISTS venda_url TEXT;
