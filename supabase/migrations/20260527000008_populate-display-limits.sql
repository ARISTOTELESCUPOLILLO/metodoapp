-- Popular limite_imgs_display e limite_renders_display com os valores
-- da Coluna 2 (Uso Normal) do PDF de planos.
-- Fonte: objeto USO_NORMAL em src/components/admin/PrecosTab.tsx
UPDATE plans SET
  limite_imgs_display = CASE codigo
    WHEN 'EX01' THEN 7
    WHEN 'PU2'  THEN 2
    WHEN 'PU4'  THEN 4
    WHEN 'PU8'  THEN 8
    WHEN 'S3V'  THEN 28
    WHEN 'S3C'  THEN 32
    WHEN 'S6V'  THEN 56
    WHEN 'S6C'  THEN 64
    WHEN 'S9V'  THEN 42
    WHEN 'S9C'  THEN 48
    ELSE limite_imgs_display
  END,
  limite_renders_display = CASE codigo
    WHEN 'S3C' THEN 4
    WHEN 'S6C' THEN 8
    WHEN 'S9C' THEN 6
    ELSE limite_renders_display
  END
WHERE codigo IN ('EX01','PU2','PU4','PU8','S3V','S3C','S6V','S6C','S9V','S9C');
