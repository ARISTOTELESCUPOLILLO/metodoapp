
-- Tabela de vozes clonadas (uma por usuário)
CREATE TABLE public.voice_clones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  eleven_voice_id TEXT NOT NULL,
  sample_path TEXT NOT NULL,
  duration_s NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_clones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voice_clones select own or admin"
  ON public.voice_clones FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "voice_clones insert own or admin"
  ON public.voice_clones FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "voice_clones update own or admin"
  ON public.voice_clones FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "voice_clones delete own or admin"
  ON public.voice_clones FOR DELETE TO authenticated
  USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_voice_clones_updated_at
  BEFORE UPDATE ON public.voice_clones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket privado para amostras de áudio
INSERT INTO storage.buckets (id, name, public)
  VALUES ('voice-samples', 'voice-samples', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "voice-samples owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'voice-samples'
         AND ((auth.uid()::text = (storage.foldername(name))[1])
              OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "voice-samples owner write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'voice-samples'
              AND ((auth.uid()::text = (storage.foldername(name))[1])
                   OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "voice-samples owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'voice-samples'
         AND ((auth.uid()::text = (storage.foldername(name))[1])
              OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "voice-samples owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'voice-samples'
         AND ((auth.uid()::text = (storage.foldername(name))[1])
              OR has_role(auth.uid(), 'admin'::app_role)));
