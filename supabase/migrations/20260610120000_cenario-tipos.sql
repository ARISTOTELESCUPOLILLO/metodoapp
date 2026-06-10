-- Kit Imagem: marca qual dos 3 cenários é "fachada" vs "ambiente".
-- Array de 3 posições, valores 'fachada' | 'ambiente'. Vazio/ausente = todos
-- tratados como 'ambiente' até o usuário marcar um como fachada.
ALTER TABLE public.user_image_kits
  ADD COLUMN IF NOT EXISTS cenario_tipos TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
