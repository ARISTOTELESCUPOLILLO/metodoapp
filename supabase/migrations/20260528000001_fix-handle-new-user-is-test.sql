-- Restaura suporte a is_test no trigger handle_new_user.
-- A migration 20260523000013 (segment-on-invite) sobrescreveu o trigger e perdeu
-- o bloco is_test, fazendo todo usuário de teste ser criado com is_test=false.
-- Esta migration unifica is_test (de 20260517194910) + segment do convite (de 20260523000013).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invite invited_emails%ROWTYPE;
  v_is_test boolean;
BEGIN
  v_is_test := COALESCE((NEW.raw_user_meta_data->>'is_test')::boolean, false);

  -- Usuários de teste: bypass de convite, perfil com is_test=true
  IF v_is_test THEN
    INSERT INTO public.profiles (id, email, nome, is_test)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
      true
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user') ON CONFLICT (user_id, role) DO NOTHING;

    RETURN NEW;
  END IF;

  -- Usuários normais: exige convite
  SELECT * INTO v_invite
  FROM invited_emails
  WHERE email = NEW.email AND status IN ('convidado', 'aceito')
  LIMIT 1;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'Email % não foi convidado. Solicite acesso ao administrador.', NEW.email
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.profiles (id, email, nome, plano1_id, plano2_id, bonus_id, segmento)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(v_invite.nome, NEW.raw_user_meta_data->>'full_name'),
    v_invite.plano1_id,
    v_invite.plano2_id,
    v_invite.bonus_id,
    COALESCE(v_invite.segment, NEW.raw_user_meta_data->>'segmento')
  )
  ON CONFLICT (id) DO UPDATE SET
    plano1_id = EXCLUDED.plano1_id,
    plano2_id = EXCLUDED.plano2_id,
    bonus_id  = EXCLUDED.bonus_id,
    segmento  = COALESCE(v_invite.segment, profiles.segmento);

  UPDATE invited_emails SET status = 'aceito', accepted_at = NOW() WHERE id = v_invite.id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user') ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Corrige profiles de testes já criados com is_test=false pelo trigger quebrado
UPDATE public.profiles
SET is_test = true
WHERE email LIKE 'teste-%@local.test'
  AND is_test = false;
