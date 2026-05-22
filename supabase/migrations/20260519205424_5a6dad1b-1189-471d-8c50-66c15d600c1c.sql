-- 1. Novas colunas
ALTER TABLE public.user_generations
  ADD COLUMN IF NOT EXISTS formato text,
  ADD COLUMN IF NOT EXISTS legenda text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS video_path text,
  ADD COLUMN IF NOT EXISTS dia integer;

-- 2. Backfill antes do NOT NULL/CHECK
UPDATE public.user_generations SET formato = 'estatico' WHERE formato IS NULL;

-- 3. Constraint
ALTER TABLE public.user_generations
  ALTER COLUMN formato SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_generations_formato_check'
  ) THEN
    ALTER TABLE public.user_generations
      ADD CONSTRAINT user_generations_formato_check
      CHECK (formato IN ('estatico','carrossel','estatico_final','reels'));
  END IF;
END $$;

-- 4. Index para eviction
CREATE INDEX IF NOT EXISTS user_generations_evict_idx
  ON public.user_generations (user_id, slot, tipo, formato, created_at);

-- 5. Recria função de eviction com formato (limite 3 por formato)
CREATE OR REPLACE FUNCTION public.list_generations_to_evict(
  _user_id uuid, _slot text, _tipo text, _formato text
)
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_limit int := 3;
  v_count int;
  v_extra int;
BEGIN
  SELECT count(*) INTO v_count
    FROM public.user_generations
   WHERE user_id = _user_id AND slot = _slot AND tipo = _tipo AND formato = _formato;
  v_extra := v_count - (v_limit - 1);
  IF v_extra <= 0 THEN RETURN; END IF;
  RETURN QUERY
    SELECT id FROM public.user_generations
     WHERE user_id = _user_id AND slot = _slot AND tipo = _tipo AND formato = _formato
     ORDER BY created_at ASC
     LIMIT v_extra;
END $function$;

-- Remove a assinatura antiga (3 args) que não é mais usada
DROP FUNCTION IF EXISTS public.list_generations_to_evict(uuid, text, text);