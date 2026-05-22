CREATE OR REPLACE FUNCTION public.list_generations_to_evict(_user_id uuid, _slot text, _tipo text)
 RETURNS SETOF uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_limit int;
  v_count int;
  v_extra int;
BEGIN
  v_limit := CASE WHEN _tipo = 'S3V' THEN 3 WHEN _tipo = 'PU' THEN 5 ELSE 3 END;
  SELECT count(*) INTO v_count
    FROM public.user_generations
   WHERE user_id = _user_id AND slot = _slot AND tipo = _tipo;
  v_extra := v_count - (v_limit - 1);
  IF v_extra <= 0 THEN RETURN; END IF;
  RETURN QUERY
    SELECT id FROM public.user_generations
     WHERE user_id = _user_id AND slot = _slot AND tipo = _tipo
     ORDER BY created_at ASC
     LIMIT v_extra;
END $function$;