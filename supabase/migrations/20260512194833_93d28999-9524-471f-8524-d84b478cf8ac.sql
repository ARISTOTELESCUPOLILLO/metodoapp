
-- Garantir search_path em todas as funções criadas (algumas já têm, outras não)
ALTER FUNCTION public.calc_cost(int, int) SET search_path = public;
ALTER FUNCTION public.has_role(uuid, public.app_role) SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.apply_plan_limits() SET search_path = public;
ALTER FUNCTION public.apply_plan_limits_insert() SET search_path = public;
ALTER FUNCTION public.fill_usage_cost() SET search_path = public;

-- Revogar EXECUTE das funções internas (só triggers/policies precisam executar)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_plan_limits() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_plan_limits_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fill_usage_cost() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- has_role precisa ser executável por usuários autenticados (RLS depende dela)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- calc_cost é segura (immutable, sem dados sensíveis)
GRANT EXECUTE ON FUNCTION public.calc_cost(int, int) TO authenticated;
