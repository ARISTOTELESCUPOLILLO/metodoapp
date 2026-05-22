-- Limpar linhas órfãs sem user_id (legado single-tenant)
DELETE FROM public.brand_kits WHERE user_id IS NULL;

-- Remover constraint UNIQUE global em company_name (impedia 2 usuários com mesmo nome de marca)
ALTER TABLE public.brand_kits DROP CONSTRAINT IF EXISTS brand_kits_company_name_key;

-- Tornar user_id obrigatório
ALTER TABLE public.brand_kits ALTER COLUMN user_id SET NOT NULL;

-- Atualizar policy de SELECT removendo o ramo legacy (user_id IS NULL)
DROP POLICY IF EXISTS "brand_kits select own or admin or legacy" ON public.brand_kits;
CREATE POLICY "brand_kits select own or admin"
ON public.brand_kits FOR SELECT
TO authenticated
USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));