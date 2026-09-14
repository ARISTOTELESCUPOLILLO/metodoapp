-- Auditoria de segurança/governança — 14/09/2026.
--
-- O cron 'expire-user-generations' (migration 20260516132516) chama o domínio
-- ANTIGO do Lovable e manda só o header `apikey`, mas a rota
-- /api/public/expire-generations exige `x-cron-secret` = CRON_SECRET.
-- Resultado: a expiração de gerações de 30 dias não roda (storage cresce e a
-- política de retenção de dados não é cumprida).
--
-- ⚠ PRÉ-REQUISITOS (manuais, antes de aplicar):
--   1. Definir o secret CRON_SECRET no Worker do Cloudflare
--      (npx wrangler secret put CRON_SECRET) com um valor aleatório longo.
--   2. Guardar o MESMO valor no Vault do Supabase com o nome 'cron_secret'
--      (Dashboard > Project Settings > Vault, ou
--       select vault.create_secret('<valor>', 'cron_secret');).
--   O segredo nunca fica escrito nesta migration.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-user-generations') THEN
    PERFORM cron.unschedule('expire-user-generations');
  END IF;
END $$;

SELECT cron.schedule(
  'expire-user-generations',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://metodoapp.oficinadepropaganda.com.br/api/public/expire-generations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
