-- Limites de display por recurso em plans.
-- Quando preenchido, o cliente vê este valor na régua (Uso Normal).
-- O limite real (Uso Estendido) permanece em limite_imagens/renders/geracoes.
-- NULL = usar o limite real como display (comportamento atual).
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS limite_imgs_display integer,
  ADD COLUMN IF NOT EXISTS limite_renders_display integer,
  ADD COLUMN IF NOT EXISTS limite_geracoes_display integer;
