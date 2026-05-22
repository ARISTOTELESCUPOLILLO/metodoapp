CREATE OR REPLACE FUNCTION public.debit_personalizado(_user_id uuid, _tipo text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin boolean;
  r RECORD;
  v_col_p1 text;
  v_col_p2 text;
  v_col_b  text;
  v_p1 int;
  v_p2 int;
  v_b  int;
BEGIN
  IF _tipo NOT IN ('estatico','carrossel','estatico_final','reels') THEN
    RAISE EXCEPTION 'tipo inválido: %', _tipo;
  END IF;

  SELECT public.has_role(_user_id, 'admin'::app_role) INTO v_admin;
  IF v_admin THEN RETURN 'admin'; END IF;

  v_col_p1 := 'extra_p1_' || _tipo;
  v_col_p2 := 'extra_p2_' || _tipo;
  v_col_b  := 'extra_b_'  || _tipo;

  EXECUTE format(
    'SELECT %I, %I, %I FROM public.profiles WHERE id = $1 FOR UPDATE',
    v_col_p1, v_col_p2, v_col_b
  ) INTO v_p1, v_p2, v_b USING _user_id;

  IF COALESCE(v_p1,0) > 0 THEN
    EXECUTE format('UPDATE public.profiles SET %I = %I - 1 WHERE id = $1', v_col_p1, v_col_p1) USING _user_id;
    RETURN 'plano1';
  ELSIF COALESCE(v_p2,0) > 0 THEN
    EXECUTE format('UPDATE public.profiles SET %I = %I - 1 WHERE id = $1', v_col_p2, v_col_p2) USING _user_id;
    RETURN 'plano2';
  ELSIF COALESCE(v_b,0) > 0 THEN
    EXECUTE format('UPDATE public.profiles SET %I = %I - 1 WHERE id = $1', v_col_b, v_col_b) USING _user_id;
    RETURN 'bonus';
  ELSE
    RAISE EXCEPTION 'sem extras de personalizacao para o tipo %', _tipo;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.debit_personalizado(uuid, text) TO authenticated;