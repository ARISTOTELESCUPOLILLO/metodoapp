
-- Bucket privado
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-assets', 'user-assets', false)
ON CONFLICT (id) DO NOTHING;

-- RLS no storage.objects para o bucket user-assets (path: {user_id}/...)
CREATE POLICY "user-assets owner select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'user-assets' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "user-assets owner insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'user-assets' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "user-assets owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'user-assets' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));

-- Tabela de gerações
CREATE TABLE public.user_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('S3V','PU')),
  slot text NOT NULL CHECK (slot IN ('plano1','plano2','bonus')),
  titulo text NOT NULL DEFAULT '',
  pdf_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);
CREATE INDEX idx_user_generations_user_slot ON public.user_generations(user_id, slot, tipo, created_at);
CREATE INDEX idx_user_generations_expires ON public.user_generations(expires_at);

ALTER TABLE public.user_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_generations owner select"
ON public.user_generations FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_generations owner insert"
ON public.user_generations FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_generations owner delete"
ON public.user_generations FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Tabela de assets
CREATE TABLE public.user_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id uuid NOT NULL REFERENCES public.user_generations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  ordem int NOT NULL DEFAULT 1,
  storage_path text NOT NULL,
  bytes int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_assets_generation ON public.user_assets(generation_id, ordem);
CREATE INDEX idx_user_assets_user ON public.user_assets(user_id);

ALTER TABLE public.user_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_assets owner select"
ON public.user_assets FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_assets owner insert"
ON public.user_assets FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_assets owner delete"
ON public.user_assets FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Função: retorna IDs de gerações antigas que devem ser apagadas para liberar espaço.
-- Limite: 2 S3V por (user, slot); 3 imagens PU por (user, slot) — cada geração PU = 1 imagem.
CREATE OR REPLACE FUNCTION public.list_generations_to_evict(
  _user_id uuid, _slot text, _tipo text
) RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int;
  v_count int;
  v_extra int;
BEGIN
  v_limit := CASE WHEN _tipo = 'S3V' THEN 2 WHEN _tipo = 'PU' THEN 3 ELSE 2 END;
  SELECT count(*) INTO v_count
    FROM public.user_generations
   WHERE user_id = _user_id AND slot = _slot AND tipo = _tipo;
  v_extra := v_count - (v_limit - 1); -- quantas precisamos apagar para liberar 1 vaga
  IF v_extra <= 0 THEN RETURN; END IF;
  RETURN QUERY
    SELECT id FROM public.user_generations
     WHERE user_id = _user_id AND slot = _slot AND tipo = _tipo
     ORDER BY created_at ASC
     LIMIT v_extra;
END $$;

-- Função: lista gerações expiradas (para cron / endpoint de limpeza)
CREATE OR REPLACE FUNCTION public.list_expired_generations()
RETURNS TABLE(id uuid, user_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, user_id FROM public.user_generations WHERE expires_at < now();
$$;

-- pg_cron + pg_net
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Cron diário às 03:00 UTC chamando endpoint público de limpeza
SELECT cron.schedule(
  'expire-user-generations',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--ab9a0009-fc78-448b-ba87-87fa92d3afe6.lovable.app/api/public/expire-generations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2dnd3aGJqdXJjYW9kamFvZnd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MjUyOTQsImV4cCI6MjA5NDAwMTI5NH0.w04_I1YMolOW125h1dc3Ne37o4yhIsSLoT5xL9iyuc0'
    ),
    body := '{}'::jsonb
  );
  $$
);
