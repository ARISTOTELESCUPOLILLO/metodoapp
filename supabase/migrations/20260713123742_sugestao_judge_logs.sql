-- Observabilidade do juiz estrutural da Sugestão (MOP+PU) — achado 13/07/2026
-- (investigação Opus+Fable, ver memória project-juiz-llm-veto-descartado-2026-07-13):
-- hoje é impossível medir a taxa real de aprovação/reprovação/fail-open do
-- juiz em produção porque nenhum veredito é persistido — só existe log
-- efêmero (console) que só aparece em wrangler tail ao vivo. Cada chamada
-- real ao juiz (judgeSugestaoEstrutural, sugestaoEngine.ts) grava 1 linha
-- aqui, inserida pela rota (suggest-keyinfo.ts) depois do motor puro rodar.
CREATE TABLE IF NOT EXISTS sugestao_judge_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ok            boolean NOT NULL,
  -- 'falha_tecnica' = fail-open (timeout/rede/JSON inválido) — juiz não
  -- avaliou de verdade. NULL = juiz respondeu (aprovou ou reprovou de fato).
  fail_reason   text CHECK (fail_reason IN ('falha_tecnica')),
  motivo        text,
  segment       text,
  mode          text,
  pass          int,
  company_name  text,
  created_at    timestamptz DEFAULT now()
);

-- Bloqueia acesso direto pelo client (apenas supabaseAdmin via server functions)
ALTER TABLE sugestao_judge_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sugestao_judge_logs_admin_only" ON sugestao_judge_logs USING (false);

CREATE INDEX IF NOT EXISTS sugestao_judge_logs_created_at_idx ON sugestao_judge_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS sugestao_judge_logs_fail_reason_idx ON sugestao_judge_logs(fail_reason);
CREATE INDEX IF NOT EXISTS sugestao_judge_logs_ok_idx ON sugestao_judge_logs(ok);
