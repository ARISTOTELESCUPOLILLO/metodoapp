
-- 1. Colunas em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS client_seq bigint,
  ADD COLUMN IF NOT EXISTS client_code text,
  ADD COLUMN IF NOT EXISTS plano1_last_charged_at timestamptz,
  ADD COLUMN IF NOT EXISTS plano2_last_charged_at timestamptz,
  ADD COLUMN IF NOT EXISTS bonus_last_charged_at  timestamptz;

CREATE SEQUENCE IF NOT EXISTS public.profiles_client_seq_seq;

-- 2. Helpers de código
CREATE OR REPLACE FUNCTION public._seg_code(_seg text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE upper(coalesce(_seg,''))
    WHEN 'SERVIÇOS' THEN '01'
    WHEN 'SERVICOS' THEN '01'
    WHEN 'VAREJO'   THEN '02'
    WHEN 'MARCA'    THEN '03'
    ELSE '00'
  END
$$;

CREATE OR REPLACE FUNCTION public._rand_letters(_n int)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  alpha text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  out text := '';
  i int;
BEGIN
  FOR i IN 1.._n LOOP
    out := out || substr(alpha, 1 + floor(random() * length(alpha))::int, 1);
  END LOOP;
  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public._rand_alnum(_n int)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  alpha text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  out text := '';
  i int;
BEGIN
  FOR i IN 1.._n LOOP
    out := out || substr(alpha, 1 + floor(random() * length(alpha))::int, 1);
  END LOOP;
  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.gen_client_code(_segmento text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_code text;
  v_tries int := 0;
BEGIN
  LOOP
    v_code := public._rand_letters(3) || '.' || public._seg_code(_segmento) || '.' || public._rand_alnum(4);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE client_code = v_code);
    v_tries := v_tries + 1;
    IF v_tries > 20 THEN RAISE EXCEPTION 'Falha ao gerar client_code único'; END IF;
  END LOOP;
  RETURN v_code;
END $$;

-- 3. Triggers
CREATE OR REPLACE FUNCTION public.profiles_set_client_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.client_seq IS NULL THEN
    NEW.client_seq := nextval('public.profiles_client_seq_seq');
  END IF;
  IF NEW.client_code IS NULL OR NEW.client_code = '' THEN
    NEW.client_code := public.gen_client_code(NEW.segmento);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.profiles_update_segment_in_code()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_parts text[];
BEGIN
  IF NEW.segmento IS DISTINCT FROM OLD.segmento AND NEW.client_code IS NOT NULL THEN
    v_parts := string_to_array(NEW.client_code, '.');
    IF array_length(v_parts,1) = 3 THEN
      NEW.client_code := v_parts[1] || '.' || public._seg_code(NEW.segmento) || '.' || v_parts[3];
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_profiles_set_client_code ON public.profiles;
CREATE TRIGGER trg_profiles_set_client_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_set_client_code();

DROP TRIGGER IF EXISTS trg_profiles_update_segment_in_code ON public.profiles;
CREATE TRIGGER trg_profiles_update_segment_in_code
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_update_segment_in_code();

-- 4. Backfill
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id, segmento FROM public.profiles WHERE client_code IS NULL ORDER BY created_at LOOP
    UPDATE public.profiles
       SET client_seq  = COALESCE(client_seq, nextval('public.profiles_client_seq_seq')),
           client_code = public.gen_client_code(r.segmento)
     WHERE id = r.id;
  END LOOP;
END $$;

-- 5. Constraints
ALTER TABLE public.profiles
  ALTER COLUMN client_code SET NOT NULL,
  ALTER COLUMN client_seq  SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_client_code_uq ON public.profiles(client_code);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_client_seq_uq  ON public.profiles(client_seq);
