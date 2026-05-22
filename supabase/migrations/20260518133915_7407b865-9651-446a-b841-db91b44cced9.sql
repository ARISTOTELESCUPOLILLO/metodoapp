-- Tabela com os caminhos do Kit Imagem por usuário
CREATE TABLE IF NOT EXISTS public.user_image_kits (
  user_id UUID NOT NULL PRIMARY KEY,
  avatar_path TEXT,
  cenarios_paths TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  produtos_paths TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_image_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_image_kits select own or admin"
  ON public.user_image_kits FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "user_image_kits insert own or admin"
  ON public.user_image_kits FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "user_image_kits update own or admin"
  ON public.user_image_kits FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "user_image_kits delete admin"
  ON public.user_image_kits FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_user_image_kits_updated_at
  BEFORE UPDATE ON public.user_image_kits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket privado para os arquivos do Kit Imagem
INSERT INTO storage.buckets (id, name, public)
VALUES ('image-kits', 'image-kits', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "image-kits select own or admin"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'image-kits'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "image-kits insert own or admin"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'image-kits'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "image-kits update own or admin"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'image-kits'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "image-kits delete own or admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'image-kits'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );