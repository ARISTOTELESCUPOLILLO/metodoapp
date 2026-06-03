-- Garante que o UNIQUE de company_name foi removido (idempotente)
ALTER TABLE public.brand_kits DROP CONSTRAINT IF EXISTS brand_kits_company_name_key;

-- Substitui o índice parcial (WHERE user_id IS NOT NULL) por uma UNIQUE CONSTRAINT completa.
-- O PostgreSQL rejeita ON CONFLICT (user_id) com índice parcial,
-- o que causava falha silenciosa no upsert de migração de Kit de Marca.
DROP INDEX IF EXISTS brand_kits_user_id_unique;
DROP INDEX IF EXISTS brand_kits_user_id_idx;
ALTER TABLE public.brand_kits ADD CONSTRAINT brand_kits_user_id_key UNIQUE (user_id);
