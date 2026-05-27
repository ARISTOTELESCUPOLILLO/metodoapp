-- Toggles independentes por avatar para habilitar gravação de voz nas trilhas cinemáticas (S3C/S6C/S9C)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS voice_avatar1_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_avatar2_enabled BOOLEAN NOT NULL DEFAULT false;
