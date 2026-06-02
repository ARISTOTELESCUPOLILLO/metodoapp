-- Corrige RLS da tabela brand_kits que estava completamente aberta (USING true).
-- Políticas novas exigem autenticação e limitam acesso ao próprio usuário ou admin.
DROP POLICY IF EXISTS "public read brand_kits"   ON public.brand_kits;
DROP POLICY IF EXISTS "public write brand_kits"  ON public.brand_kits;
DROP POLICY IF EXISTS "public update brand_kits" ON public.brand_kits;
DROP POLICY IF EXISTS "public delete brand_kits" ON public.brand_kits;

CREATE POLICY "brand_kits_select" ON public.brand_kits FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "brand_kits_insert" ON public.brand_kits FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "brand_kits_update" ON public.brand_kits FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "brand_kits_delete" ON public.brand_kits FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
