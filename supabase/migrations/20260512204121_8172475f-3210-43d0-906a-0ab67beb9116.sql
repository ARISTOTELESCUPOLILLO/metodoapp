
CREATE TABLE public.invited_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'convidado',
  invited_by uuid,
  plano_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invited_emails_email ON public.invited_emails (lower(email));

ALTER TABLE public.invited_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invites admin all"
ON public.invited_emails
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Normaliza email
CREATE OR REPLACE FUNCTION public.invited_emails_normalize()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.email := lower(trim(NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invited_emails_normalize
BEFORE INSERT OR UPDATE ON public.invited_emails
FOR EACH ROW EXECUTE FUNCTION public.invited_emails_normalize();

-- Atualiza handle_new_user para validar whitelist
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(NEW.email));
  v_invite RECORD;
  v_is_admin boolean;
BEGIN
  -- Admin já existente (raro: criado via console) sempre passa
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'admin')
    INTO v_is_admin;

  SELECT * INTO v_invite FROM public.invited_emails
   WHERE email = v_email AND status IN ('convidado','aceito')
   LIMIT 1;

  IF v_invite.id IS NULL AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Email % não foi convidado. Solicite acesso ao administrador.', v_email
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.profiles (id, email, nome, plano_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)),
    v_invite.plano_id
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  IF v_invite.id IS NOT NULL THEN
    UPDATE public.invited_emails
       SET status = 'aceito', accepted_at = now()
     WHERE id = v_invite.id;
  END IF;

  RETURN NEW;
END;
$$;
