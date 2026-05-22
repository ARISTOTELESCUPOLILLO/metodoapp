
-- voice_clones: prepara pra provider fal.ai MiniMax
ALTER TABLE public.voice_clones
  RENAME COLUMN eleven_voice_id TO external_voice_id;

ALTER TABLE public.voice_clones
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'fal-minimax',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

-- garante 1 voz ativa por usuário (re-treinar substitui)
CREATE UNIQUE INDEX IF NOT EXISTS voice_clones_user_unique
  ON public.voice_clones (user_id);
