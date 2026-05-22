
ALTER FUNCTION public._seg_code(text) SET search_path = public;
ALTER FUNCTION public._rand_letters(int) SET search_path = public;
ALTER FUNCTION public._rand_alnum(int) SET search_path = public;
ALTER FUNCTION public.gen_client_code(text) SET search_path = public;
ALTER FUNCTION public.profiles_set_client_code() SET search_path = public;
ALTER FUNCTION public.profiles_update_segment_in_code() SET search_path = public;
