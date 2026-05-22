ALTER TABLE public.invited_emails ADD COLUMN IF NOT EXISTS nome text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text := lower(trim(NEW.email));
  v_invite RECORD;
  v_is_admin boolean;
BEGIN
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
    COALESCE(NEW.raw_user_meta_data->>'nome', v_invite.nome, split_part(NEW.email,'@',1)),
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
$function$;