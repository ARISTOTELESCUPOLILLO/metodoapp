
-- 1) Catálogo: elegivel_bonus + PU2 + atualizar limites/preços (Uso estendido alto)
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS elegivel_bonus BOOLEAN NOT NULL DEFAULT false;

INSERT INTO public.plans (codigo, nome, tipo, limite_imagens, limite_renders, valor_plano, ativo, elegivel_bonus)
VALUES ('PU2', 'Post Único 2', 'post', 3, 0, 1.34, true, true)
ON CONFLICT DO NOTHING;

UPDATE public.plans SET limite_imagens=6,  limite_renders=0,  valor_plano=2.48,  elegivel_bonus=false WHERE codigo='PU4';
UPDATE public.plans SET limite_imagens=12, limite_renders=0,  valor_plano=4.96,  elegivel_bonus=false WHERE codigo='PU8';
UPDATE public.plans SET limite_imagens=14, limite_renders=0,  valor_plano=5.52,  elegivel_bonus=true  WHERE codigo='EX01';
UPDATE public.plans SET limite_imagens=42, limite_renders=0,  valor_plano=16.26, elegivel_bonus=false WHERE codigo='S3V';
UPDATE public.plans SET limite_imagens=84, limite_renders=0,  valor_plano=32.52, elegivel_bonus=false WHERE codigo='S6V';
UPDATE public.plans SET limite_imagens=58, limite_renders=0,  valor_plano=22.54, elegivel_bonus=false WHERE codigo='S9V';
UPDATE public.plans SET limite_imagens=42, limite_renders=6,  valor_plano=25.46, elegivel_bonus=false WHERE codigo='S3C';
UPDATE public.plans SET limite_imagens=84, limite_renders=12, valor_plano=50.72, elegivel_bonus=false WHERE codigo='S6C';
UPDATE public.plans SET limite_imagens=58, limite_renders=9,  valor_plano=36.24, elegivel_bonus=false WHERE codigo='S9C';

-- 2) Slots em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plano1_id UUID REFERENCES public.plans(id),
  ADD COLUMN IF NOT EXISTS plano1_inicio TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plano1_imgs_usadas INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plano1_imgs_limite INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plano1_renders_usados INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plano1_renders_limite INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plano2_id UUID REFERENCES public.plans(id),
  ADD COLUMN IF NOT EXISTS plano2_inicio TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plano2_imgs_usadas INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plano2_imgs_limite INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plano2_renders_usados INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plano2_renders_limite INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_id UUID REFERENCES public.plans(id),
  ADD COLUMN IF NOT EXISTS bonus_inicio TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bonus_imgs_usadas INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_imgs_limite INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_renders_usados INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_renders_limite INT NOT NULL DEFAULT 0;

-- Migrar plano_id atual -> plano1
UPDATE public.profiles p
SET plano1_id = p.plano_id,
    plano1_inicio = COALESCE(p.plano1_inicio, p.created_at),
    plano1_imgs_usadas = p.imagens_usadas,
    plano1_imgs_limite = p.imagens_limite,
    plano1_renders_usados = p.renders_usados,
    plano1_renders_limite = p.renders_limite
WHERE p.plano_id IS NOT NULL AND p.plano1_id IS NULL;

-- 3) Trigger único para limites por slot
DROP TRIGGER IF EXISTS apply_plan_limits_trg ON public.profiles;
DROP TRIGGER IF EXISTS apply_plan_limits_insert_trg ON public.profiles;

CREATE OR REPLACE FUNCTION public.apply_slot_limits()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_li INT; v_lr INT; v_bonus BOOLEAN;
BEGIN
  -- Slot 1
  IF TG_OP='INSERT' OR NEW.plano1_id IS DISTINCT FROM OLD.plano1_id THEN
    IF NEW.plano1_id IS NULL THEN
      NEW.plano1_imgs_limite:=0; NEW.plano1_renders_limite:=0;
      NEW.plano1_imgs_usadas:=0; NEW.plano1_renders_usados:=0;
      NEW.plano1_inicio:=NULL;
    ELSE
      SELECT limite_imagens, limite_renders INTO v_li, v_lr FROM public.plans WHERE id=NEW.plano1_id;
      NEW.plano1_imgs_limite:=COALESCE(v_li,0); NEW.plano1_renders_limite:=COALESCE(v_lr,0);
      NEW.plano1_imgs_usadas:=0; NEW.plano1_renders_usados:=0;
      NEW.plano1_inicio:=now();
    END IF;
  END IF;
  -- Slot 2
  IF TG_OP='INSERT' OR NEW.plano2_id IS DISTINCT FROM OLD.plano2_id THEN
    IF NEW.plano2_id IS NULL THEN
      NEW.plano2_imgs_limite:=0; NEW.plano2_renders_limite:=0;
      NEW.plano2_imgs_usadas:=0; NEW.plano2_renders_usados:=0;
      NEW.plano2_inicio:=NULL;
    ELSE
      SELECT limite_imagens, limite_renders INTO v_li, v_lr FROM public.plans WHERE id=NEW.plano2_id;
      NEW.plano2_imgs_limite:=COALESCE(v_li,0); NEW.plano2_renders_limite:=COALESCE(v_lr,0);
      NEW.plano2_imgs_usadas:=0; NEW.plano2_renders_usados:=0;
      NEW.plano2_inicio:=now();
    END IF;
  END IF;
  -- Bônus (valida elegibilidade)
  IF TG_OP='INSERT' OR NEW.bonus_id IS DISTINCT FROM OLD.bonus_id THEN
    IF NEW.bonus_id IS NULL THEN
      NEW.bonus_imgs_limite:=0; NEW.bonus_renders_limite:=0;
      NEW.bonus_imgs_usadas:=0; NEW.bonus_renders_usados:=0;
      NEW.bonus_inicio:=NULL;
    ELSE
      SELECT limite_imagens, limite_renders, elegivel_bonus
        INTO v_li, v_lr, v_bonus FROM public.plans WHERE id=NEW.bonus_id;
      IF NOT COALESCE(v_bonus,false) THEN
        RAISE EXCEPTION 'Plano selecionado não é elegível para bônus';
      END IF;
      NEW.bonus_imgs_limite:=COALESCE(v_li,0); NEW.bonus_renders_limite:=COALESCE(v_lr,0);
      NEW.bonus_imgs_usadas:=0; NEW.bonus_renders_usados:=0;
      NEW.bonus_inicio:=now();
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER apply_slot_limits_trg
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.apply_slot_limits();

-- 4) usage_logs.slot
ALTER TABLE public.usage_logs ADD COLUMN IF NOT EXISTS slot TEXT;

-- 5) RPC debit_usage
CREATE OR REPLACE FUNCTION public.debit_usage(_user_id UUID, _imgs INT, _renders INT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin BOOLEAN;
  v_slot TEXT := NULL;
  r RECORD;
BEGIN
  SELECT public.has_role(_user_id, 'admin'::app_role) INTO v_admin;
  IF v_admin THEN RETURN 'admin'; END IF;

  SELECT * INTO r FROM public.profiles WHERE id=_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;

  -- Tenta bônus
  IF r.bonus_id IS NOT NULL
     AND (r.bonus_imgs_limite - r.bonus_imgs_usadas) >= COALESCE(_imgs,0)
     AND (r.bonus_renders_limite - r.bonus_renders_usados) >= COALESCE(_renders,0) THEN
    UPDATE public.profiles
       SET bonus_imgs_usadas = bonus_imgs_usadas + COALESCE(_imgs,0),
           bonus_renders_usados = bonus_renders_usados + COALESCE(_renders,0)
     WHERE id=_user_id;
    RETURN 'bonus';
  END IF;

  -- Plano 1
  IF r.plano1_id IS NOT NULL
     AND (r.plano1_imgs_limite - r.plano1_imgs_usadas) >= COALESCE(_imgs,0)
     AND (r.plano1_renders_limite - r.plano1_renders_usados) >= COALESCE(_renders,0) THEN
    UPDATE public.profiles
       SET plano1_imgs_usadas = plano1_imgs_usadas + COALESCE(_imgs,0),
           plano1_renders_usados = plano1_renders_usados + COALESCE(_renders,0)
     WHERE id=_user_id;
    RETURN 'plano1';
  END IF;

  -- Plano 2
  IF r.plano2_id IS NOT NULL
     AND (r.plano2_imgs_limite - r.plano2_imgs_usadas) >= COALESCE(_imgs,0)
     AND (r.plano2_renders_limite - r.plano2_renders_usados) >= COALESCE(_renders,0) THEN
    UPDATE public.profiles
       SET plano2_imgs_usadas = plano2_imgs_usadas + COALESCE(_imgs,0),
           plano2_renders_usados = plano2_renders_usados + COALESCE(_renders,0)
     WHERE id=_user_id;
    RETURN 'plano2';
  END IF;

  RAISE EXCEPTION 'Limite atingido em todos os planos';
END $$;

-- 6) Convites: 3 slots
ALTER TABLE public.invited_emails
  ADD COLUMN IF NOT EXISTS plano1_id UUID REFERENCES public.plans(id),
  ADD COLUMN IF NOT EXISTS plano2_id UUID REFERENCES public.plans(id),
  ADD COLUMN IF NOT EXISTS bonus_id  UUID REFERENCES public.plans(id);

UPDATE public.invited_emails SET plano1_id = plano_id WHERE plano1_id IS NULL AND plano_id IS NOT NULL;

-- 7) handle_new_user atualizado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text := lower(trim(NEW.email));
  v_invite RECORD;
  v_is_admin boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'admin') INTO v_is_admin;

  SELECT * INTO v_invite FROM public.invited_emails
   WHERE email = v_email AND status IN ('convidado','aceito') LIMIT 1;

  IF v_invite.id IS NULL AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Email % não foi convidado. Solicite acesso ao administrador.', v_email
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.profiles (id, email, nome, plano1_id, plano2_id, bonus_id)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', v_invite.nome, split_part(NEW.email,'@',1)),
    v_invite.plano1_id, v_invite.plano2_id, v_invite.bonus_id
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user') ON CONFLICT (user_id, role) DO NOTHING;

  IF v_invite.id IS NOT NULL THEN
    UPDATE public.invited_emails SET status='aceito', accepted_at=now() WHERE id=v_invite.id;
  END IF;

  RETURN NEW;
END $$;
