
-- Novo código de segmento em 3 dígitos
CREATE OR REPLACE FUNCTION public._seg_code(_seg text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE upper(coalesce(_seg,''))
    WHEN 'SERVIÇOS' THEN '001'
    WHEN 'SERVICOS' THEN '001'
    WHEN 'VAREJO'   THEN '002'
    WHEN 'MARCA'    THEN '003'
    ELSE '000'
  END
$function$;

-- Coluna de sequência por segmento
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS client_seq_segmento integer;

-- Geração do código: SSS.NN.LLLL (NN cresce além de 99 quando preciso)
CREATE OR REPLACE FUNCTION public.gen_client_code(_segmento text, _seq integer)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_code text;
  v_tries int := 0;
  v_seq_txt text;
BEGIN
  v_seq_txt := CASE WHEN _seq < 100 THEN lpad(_seq::text, 2, '0') ELSE _seq::text END;
  LOOP
    v_code := public._seg_code(_segmento) || '.' || v_seq_txt || '.' || public._rand_letters(4);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE client_code = v_code);
    v_tries := v_tries + 1;
    IF v_tries > 20 THEN RAISE EXCEPTION 'Falha ao gerar client_code único'; END IF;
  END LOOP;
  RETURN v_code;
END $function$;

-- Trigger insert: calcula próxima sequência do segmento sob lock
CREATE OR REPLACE FUNCTION public.profiles_set_client_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_seg text := public._seg_code(NEW.segmento);
  v_lock_key bigint;
  v_next int;
BEGIN
  IF NEW.client_seq IS NULL THEN
    NEW.client_seq := nextval('public.profiles_client_seq_seq');
  END IF;
  IF NEW.client_seq_segmento IS NULL OR NEW.client_code IS NULL OR NEW.client_code = '' THEN
    v_lock_key := ('x' || lpad(md5('cseq:' || v_seg), 16, '0'))::bit(64)::bigint;
    PERFORM pg_advisory_xact_lock(v_lock_key);
    SELECT COALESCE(MAX(client_seq_segmento), 0) + 1
      INTO v_next
      FROM public.profiles
     WHERE public._seg_code(segmento) = v_seg;
    NEW.client_seq_segmento := v_next;
    IF NEW.client_code IS NULL OR NEW.client_code = '' THEN
      NEW.client_code := public.gen_client_code(NEW.segmento, v_next);
    END IF;
  END IF;
  RETURN NEW;
END $function$;

-- Trigger update: ao trocar segmento, recalcula a sequência no novo segmento e refaz o código
CREATE OR REPLACE FUNCTION public.profiles_update_segment_in_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_seg text;
  v_lock_key bigint;
  v_next int;
  v_parts text[];
  v_letters text;
BEGIN
  IF NEW.segmento IS DISTINCT FROM OLD.segmento THEN
    v_seg := public._seg_code(NEW.segmento);
    v_lock_key := ('x' || lpad(md5('cseq:' || v_seg), 16, '0'))::bit(64)::bigint;
    PERFORM pg_advisory_xact_lock(v_lock_key);
    SELECT COALESCE(MAX(client_seq_segmento), 0) + 1
      INTO v_next
      FROM public.profiles
     WHERE public._seg_code(segmento) = v_seg
       AND id <> NEW.id;
    NEW.client_seq_segmento := v_next;
    -- preserva as 4 letras finais se já existirem; senão sorteia novas
    v_letters := NULL;
    IF NEW.client_code IS NOT NULL THEN
      v_parts := string_to_array(NEW.client_code, '.');
      IF array_length(v_parts, 1) = 3 THEN v_letters := v_parts[3]; END IF;
    END IF;
    IF v_letters IS NULL OR length(v_letters) < 3 THEN
      v_letters := public._rand_letters(4);
    END IF;
    NEW.client_code := v_seg || '.' ||
      CASE WHEN v_next < 100 THEN lpad(v_next::text, 2, '0') ELSE v_next::text END ||
      '.' || v_letters;
  END IF;
  RETURN NEW;
END $function$;

-- Backfill: recalcula sequência por segmento e código de todos os perfis,
-- respeitando ordem de criação dentro de cada segmento.
WITH ranked AS (
  SELECT id,
         segmento,
         row_number() OVER (PARTITION BY public._seg_code(segmento) ORDER BY created_at, id) AS rn
    FROM public.profiles
)
UPDATE public.profiles p
   SET client_seq_segmento = r.rn,
       client_code = public._seg_code(p.segmento) || '.' ||
                     CASE WHEN r.rn < 100 THEN lpad(r.rn::text, 2, '0') ELSE r.rn::text END ||
                     '.' || public._rand_letters(4)
  FROM ranked r
 WHERE p.id = r.id;
