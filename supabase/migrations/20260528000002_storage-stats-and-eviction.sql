-- 1. Eleva limite de eviction de 3 → 6 gerações por (usuário, slot, tipo, formato).
--    Suporta até 48 imagens + 6 renders arquivados por usuário (rolling 30 dias).
CREATE OR REPLACE FUNCTION public.list_generations_to_evict(
  _user_id uuid, _slot text, _tipo text, _formato text
)
RETURNS SETOF uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_limit int := 6;
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
END $$;

-- 2. Agrega uso do bucket user-assets a partir de storage.objects.
--    Retorna total de bytes/arquivos + breakdown por usuário.
CREATE OR REPLACE FUNCTION public.admin_storage_stats()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  RETURN (
    SELECT json_build_object(
      'total_bytes', COALESCE(SUM((o.metadata->>'size')::bigint), 0),
      'total_files', COUNT(*),
      'by_user', (
        SELECT COALESCE(json_agg(u ORDER BY u.bytes DESC), '[]'::json)
        FROM (
          SELECT
            split_part(o2.name, '/', 1) AS user_id,
            COALESCE(SUM((o2.metadata->>'size')::bigint), 0) AS bytes,
            COUNT(*) AS files
          FROM storage.objects o2
          WHERE o2.bucket_id = 'user-assets'
            AND o2.metadata IS NOT NULL
          GROUP BY 1
        ) u
      )
    )
    FROM storage.objects o
    WHERE o.bucket_id = 'user-assets'
      AND o.metadata IS NOT NULL
  );
END $$;

GRANT EXECUTE ON FUNCTION public.admin_storage_stats() TO service_role;
