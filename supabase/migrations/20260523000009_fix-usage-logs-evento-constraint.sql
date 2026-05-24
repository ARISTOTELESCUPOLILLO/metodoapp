-- Bug fix: remove CHECK constraint on usage_logs.evento
-- A constraint hardcoded to ('geracao','login','troca_plano','bloqueio','erro_api')
-- was silently rejecting every insert from the API routes
-- ('image.generate', 'gerar_conteudo_mop', 'video.generate', etc.).
-- The try/catch in usage.server.ts swallowed the error, so usage_logs stayed empty.
ALTER TABLE public.usage_logs DROP CONSTRAINT IF EXISTS usage_logs_evento_check;
