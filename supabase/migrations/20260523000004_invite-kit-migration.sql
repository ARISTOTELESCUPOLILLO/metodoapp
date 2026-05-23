-- Permite associar um perfil de teste ao convite para migração de Kit Imagem
ALTER TABLE public.invited_emails
  ADD COLUMN IF NOT EXISTS source_test_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Registra quando o kit foi migrado
ALTER TABLE public.invited_emails
  ADD COLUMN IF NOT EXISTS kit_migrated_at TIMESTAMPTZ;
