-- Fachada ganha slot próprio no Kit Imagem (antes era um dos cenario_tipos,
-- dentro do pool de cenários). cenario_tipos fica como coluna legada, sem uso
-- novo, e não é removida para não perder histórico.
ALTER TABLE public.user_image_kits
  ADD COLUMN IF NOT EXISTS fachada_path TEXT;
