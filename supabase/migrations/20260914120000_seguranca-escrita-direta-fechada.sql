-- Auditoria de segurança — 14/09/2026.
--
-- Fecha escrita direta (anon key + JWT do próprio usuário, sem passar pelo
-- servidor) em tabelas e bucket onde o app SÓ escreve pelo servidor, com
-- supabaseAdmin (service role, que ignora RLS e GRANTs). Conferido no código:
-- nenhum componente/hook do navegador faz insert/update/delete nessas tabelas.
--
-- ⚠ APLICAR ANTES DO DEPLOY do código da branch fix/seguranca-app-atual:
--   o /api/generate-image passou a consultar usage_logs para não cobrar duas
--   vezes o mesmo job; com INSERT aberto, o usuário poderia forjar essa linha.

-- 1) profiles — a policy "profiles user update own nome" liberava UPDATE da
--    LINHA INTEIRA para o dono (limites, contadores de uso, is_test, beta_*).
--    Toda alteração legítima de perfil é feita por server function com
--    supabaseAdmin (lib/users.functions.ts, planHistory, cobrancas, testUsers).
DROP POLICY IF EXISTS "profiles user update own nome" ON public.profiles;
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon, authenticated;

-- 2) usage_logs — usuário podia inserir linhas próprias: poluía custos e o
--    rate limit e, a partir de agora, a checagem de débito repetido.
DROP POLICY IF EXISTS "usage_logs insert authenticated" ON public.usage_logs;
REVOKE INSERT, UPDATE, DELETE ON public.usage_logs FROM anon, authenticated;

-- 3) Bucket pdfs — INSERT/UPDATE eram públicos (qualquer pessoa, sem login,
--    podia subir ou sobrescrever arquivos). O upload real é feito pelo
--    servidor (routes/api/supabase-pdf.ts, supabaseAdmin). A leitura pública
--    continua, porque o link do PDF é público (getPublicUrl).
DROP POLICY IF EXISTS "public write pdfs" ON storage.objects;
DROP POLICY IF EXISTS "public update pdfs" ON storage.objects;

-- 4) meta_connections — existia no banco sem migration (criada fora do
--    versionamento) e guarda tokens de acesso do Facebook/Instagram.
--    Só o servidor lê e escreve (lib/meta.server.ts, routes/api/meta/*).
CREATE TABLE IF NOT EXISTS public.meta_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  user_access_token text NOT NULL,
  long_lived_token text,
  fb_page_id text,
  fb_page_name text,
  fb_page_access_token text,
  ig_user_id text,
  ig_username text,
  scopes text,
  token_expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.meta_connections ENABLE ROW LEVEL SECURITY;
-- Sem policy para anon/authenticated = nenhuma linha visível/alterável por eles.
REVOKE ALL ON public.meta_connections FROM anon, authenticated;
