
REVOKE EXECUTE ON FUNCTION public.list_generations_to_evict(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.list_expired_generations() FROM PUBLIC, anon, authenticated;
