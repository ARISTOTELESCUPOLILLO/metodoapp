-- Adicionar coluna segmento ao profile do usuário
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS segmento text
  CHECK (segmento IN ('SERVIÇOS', 'VAREJO', 'MARCA'));

-- Backfill com o segmento mais recente do brand_kit do usuário
UPDATE public.profiles p
   SET segmento = bk.segment
  FROM (
    SELECT DISTINCT ON (user_id) user_id, segment
      FROM public.brand_kits
      WHERE segment IS NOT NULL
      ORDER BY user_id, updated_at DESC
  ) bk
 WHERE bk.user_id = p.id
   AND p.segmento IS NULL;