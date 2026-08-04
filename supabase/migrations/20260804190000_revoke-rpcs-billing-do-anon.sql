-- Fecha ao público as funções de billing e de estatística (achado 04/08/2026,
-- na mesma auditoria que apontou as tabelas sem RLS).
--
-- O furo, verificado na prática com a chave anon (a que está embutida no bundle
-- do front, pública por design) e SEM nenhum login:
--   1. POST /rest/v1/rpc/admin_storage_stats devolvia os UUIDs dos 19 usuários
--      com o volume de arquivos de cada um — a função é SECURITY DEFINER e não
--      checa role nenhuma (o `admin_` do nome era só convenção);
--   2. de posse desses UUIDs, /rest/v1/rpc/debit_usage aceitava debitar a cota
--      de QUALQUER usuário: a função recebe _user_id por parâmetro e nunca
--      compara com auth.uid(). É o gate do billing aberto para fora;
--   3. debit_personalizado tem o mesmo desenho (e nem é mais chamada pelo app).
-- (2) e (3) não foram testados de propósito — seria queimar cota de cliente
-- real. (1) foi, e funcionou.
--
-- reset_all_usage entra junto por defesa em profundidade: ela JÁ se protege por
-- dentro (has_role(auth.uid(),'admin')), mas não há motivo para ficar exposta.
--
-- Por que não quebra o app: todas as chamadas saem de server function com
-- requireSupabaseAuth + assertAdmin e usam `supabaseAdmin` (service role) —
-- storageStats.functions.ts, custos.functions.ts, usage.server.ts,
-- assets.functions.ts. O service role não passa por estes grants, e ainda
-- assim ele é reafirmado explicitamente abaixo.
--
-- Escopo deliberadamente cirúrgico: os helpers e as funções de trigger que
-- também aparecem como executáveis por anon (gen_client_code, calc_cost,
-- _rand_*, _seg_code, profiles_set_client_code, apply_slot_limits,
-- invited_emails_normalize) NÃO entram aqui — algumas são chamadas de dentro
-- de triggers que rodam no contexto do usuário autenticado, e revogá-las
-- quebraria signup/insert. Nenhuma delas lê ou altera dado de terceiro.
-- has_role também fica como está: as policies de RLS dependem de `authenticated`
-- poder executá-la (para `anon` ela já estava revogada).

REVOKE EXECUTE ON FUNCTION public.admin_storage_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_storage_stats() TO service_role;

REVOKE EXECUTE ON FUNCTION public.debit_usage(uuid, integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.debit_usage(uuid, integer, integer, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.debit_usage(uuid, integer, integer, integer, text, integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.debit_usage(uuid, integer, integer, integer, text, integer, integer, integer)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.debit_personalizado(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.debit_personalizado(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.list_generations_to_evict(uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_generations_to_evict(uuid, text, text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.reset_all_usage() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_all_usage() TO service_role;
