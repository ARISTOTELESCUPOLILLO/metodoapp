-- Histórico de ciclos de plano por usuário (ledger append-only)
-- Cada row representa um ciclo fechado: do início até a renovação/remoção/troca.
CREATE TABLE IF NOT EXISTS plan_purchases (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slot                  text NOT NULL CHECK (slot IN ('plano1', 'plano2', 'bonus')),
  plan_id               uuid REFERENCES plans(id),
  plan_codigo           text,
  plan_nome             text,
  inicio                timestamptz,
  expira_em             timestamptz,
  preco_brl             numeric,
  imgs_limite           int NOT NULL DEFAULT 0,
  renders_limite        int NOT NULL DEFAULT 0,
  geracoes_limite       int NOT NULL DEFAULT 0,
  imgs_usadas_final     int NOT NULL DEFAULT 0,
  renders_usados_final  int NOT NULL DEFAULT 0,
  geracoes_usados_final int NOT NULL DEFAULT 0,
  motivo_fechamento     text CHECK (motivo_fechamento IN ('renovacao', 'troca_plano', 'remocao')),
  assigned_by           uuid,
  closed_by             uuid,
  created_at            timestamptz DEFAULT now()
);

-- Bloqueia acesso direto pelo client (apenas supabaseAdmin via server functions)
ALTER TABLE plan_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_purchases_admin_only" ON plan_purchases USING (false);

-- Índices para queries comuns
CREATE INDEX IF NOT EXISTS plan_purchases_user_id_idx ON plan_purchases(user_id);
CREATE INDEX IF NOT EXISTS plan_purchases_created_at_idx ON plan_purchases(created_at DESC);
