
-- =========================================================
-- ENUM de papéis (separado de profiles, padrão seguro)
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- =========================================================
-- TABELA plans
-- =========================================================
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  limite_imagens INT NOT NULL DEFAULT 0,
  limite_renders INT NOT NULL DEFAULT 0,
  valor_plano NUMERIC(10,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- TABELA profiles
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  email TEXT NOT NULL,
  plano_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','bloqueado')),
  imagens_usadas INT NOT NULL DEFAULT 0,
  imagens_limite INT NOT NULL DEFAULT 0,
  renders_usados INT NOT NULL DEFAULT 0,
  renders_limite INT NOT NULL DEFAULT 0,
  ultimo_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- TABELA user_roles
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- TABELA usage_logs
-- =========================================================
CREATE TABLE public.usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  evento TEXT NOT NULL CHECK (evento IN ('geracao','login','troca_plano','bloqueio','erro_api')),
  modulo TEXT,
  qtd_imagens INT NOT NULL DEFAULT 0,
  qtd_renders INT NOT NULL DEFAULT 0,
  custo_usd NUMERIC(10,4) NOT NULL DEFAULT 0,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_logs_user ON public.usage_logs(user_id);
CREATE INDEX idx_usage_logs_created ON public.usage_logs(created_at DESC);

ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- TABELA user_sequences
-- =========================================================
CREATE TABLE public.user_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_sequencia TEXT NOT NULL,
  tipo TEXT,
  json_conteudo JSONB,
  download_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_sequences ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- FUNÇÕES utilitárias
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.calc_cost(_imgs INT, _renders INT)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (_imgs::NUMERIC * 0.38) + (_renders::NUMERIC * 1.20);
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Cria profile e role 'user' ao criar conta em auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Aplica limites e zera contadores ao trocar de plano
CREATE OR REPLACE FUNCTION public.apply_plan_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_li INT;
  v_lr INT;
BEGIN
  IF NEW.plano_id IS DISTINCT FROM OLD.plano_id THEN
    IF NEW.plano_id IS NULL THEN
      NEW.imagens_limite := 0;
      NEW.renders_limite := 0;
    ELSE
      SELECT limite_imagens, limite_renders INTO v_li, v_lr
      FROM public.plans WHERE id = NEW.plano_id;
      NEW.imagens_limite := COALESCE(v_li, 0);
      NEW.renders_limite := COALESCE(v_lr, 0);
    END IF;
    NEW.imagens_usadas := 0;
    NEW.renders_usados := 0;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_plan_limits
BEFORE UPDATE OF plano_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.apply_plan_limits();

-- Define limites iniciais ao definir plano em INSERT
CREATE OR REPLACE FUNCTION public.apply_plan_limits_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_li INT;
  v_lr INT;
BEGIN
  IF NEW.plano_id IS NOT NULL THEN
    SELECT limite_imagens, limite_renders INTO v_li, v_lr
    FROM public.plans WHERE id = NEW.plano_id;
    NEW.imagens_limite := COALESCE(v_li, 0);
    NEW.renders_limite := COALESCE(v_lr, 0);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_plan_limits_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.apply_plan_limits_insert();

-- updated_at
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_plans_updated_at
BEFORE UPDATE ON public.plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Calcula custo automaticamente em usage_logs
CREATE OR REPLACE FUNCTION public.fill_usage_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.custo_usd := public.calc_cost(COALESCE(NEW.qtd_imagens,0), COALESCE(NEW.qtd_renders,0));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fill_usage_cost
BEFORE INSERT ON public.usage_logs
FOR EACH ROW EXECUTE FUNCTION public.fill_usage_cost();

-- =========================================================
-- RLS POLICIES
-- =========================================================

-- plans
CREATE POLICY "plans select authenticated"
ON public.plans FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "plans admin write"
ON public.plans FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- profiles
CREATE POLICY "profiles user select own"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "profiles user update own nome"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles admin all"
ON public.profiles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "user_roles select self or admin"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_roles admin write"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- usage_logs
CREATE POLICY "usage_logs insert authenticated"
ON public.usage_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "usage_logs select admin or self"
ON public.usage_logs FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- user_sequences
CREATE POLICY "sequences select self or admin"
ON public.user_sequences FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "sequences user write own"
ON public.user_sequences FOR ALL
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- =========================================================
-- STORAGE bucket privado
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-sequences', 'user-sequences', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "user-sequences select self or admin"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'user-sequences'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "user-sequences insert self or admin"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-sequences'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "user-sequences update self or admin"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-sequences'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "user-sequences delete self or admin"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-sequences'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
  )
);
