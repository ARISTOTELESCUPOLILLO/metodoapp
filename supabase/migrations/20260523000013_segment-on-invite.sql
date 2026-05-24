-- Adiciona campo segment ao convite — admin define na criação, usuário não pode alterar.

ALTER TABLE invited_emails
  ADD COLUMN IF NOT EXISTS segment TEXT DEFAULT NULL
  CHECK (segment IS NULL OR segment IN ('SERVIÇOS', 'VAREJO', 'MARCA'));

-- Atualiza o trigger handle_new_user para copiar o segment do convite para o perfil.
-- Se o convite não tiver segment, mantém o que o frontend escolheu (backward compat).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite invited_emails%ROWTYPE;
BEGIN
  -- Busca convite pelo e-mail
  SELECT * INTO v_invite
  FROM invited_emails
  WHERE email = NEW.email
    AND status = 'convidado'
  LIMIT 1;

  IF v_invite.id IS NOT NULL THEN
    -- Usuário convidado: cria perfil com dados do convite
    INSERT INTO public.profiles (
      id, email, nome,
      plano1_id, plano2_id, bonus_id,
      segmento
    ) VALUES (
      NEW.id,
      NEW.email,
      COALESCE(v_invite.nome, NEW.raw_user_meta_data->>'full_name'),
      v_invite.plano1_id,
      v_invite.plano2_id,
      v_invite.bonus_id,
      -- Segment do convite tem prioridade; fallback para o que o frontend enviou
      COALESCE(v_invite.segment, NEW.raw_user_meta_data->>'segmento')
    )
    ON CONFLICT (id) DO UPDATE SET
      plano1_id = EXCLUDED.plano1_id,
      plano2_id = EXCLUDED.plano2_id,
      bonus_id  = EXCLUDED.bonus_id,
      segmento  = COALESCE(v_invite.segment, profiles.segmento);

    -- Marca o convite como aceito
    UPDATE invited_emails
    SET status = 'aceito', accepted_at = NOW()
    WHERE id = v_invite.id;

    -- Aplica os limites dos planos (trigger apply_slot_limits cuida disso)
  ELSE
    -- Usuário sem convite (admin, etc.): cria perfil básico
    INSERT INTO public.profiles (id, email, nome, segmento)
    VALUES (
      NEW.id,
      NEW.email,
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'segmento'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
