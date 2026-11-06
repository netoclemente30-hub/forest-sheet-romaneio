CREATE OR REPLACE FUNCTION public.admin_minha_empresa()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN public.has_role(auth.uid(), 'superadmin')
    THEN NULL
    ELSE (SELECT empresa_id FROM public.empresa_usuarios WHERE user_id = auth.uid())
  END
$$;

DROP POLICY IF EXISTS "empresa arvores" ON public.arvores;
CREATE POLICY "empresa arvores" ON public.arvores FOR ALL TO authenticated
  USING (empresa_id = minha_empresa() OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (empresa_id = minha_empresa() OR public.has_role(auth.uid(), 'superadmin'));

DROP POLICY IF EXISTS "empresa toras" ON public.toras;
CREATE POLICY "empresa toras" ON public.toras FOR ALL TO authenticated
  USING (empresa_id = minha_empresa() OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (empresa_id = minha_empresa() OR public.has_role(auth.uid(), 'superadmin'));

DROP POLICY IF EXISTS "empresa romaneios" ON public.romaneios;
CREATE POLICY "empresa romaneios" ON public.romaneios FOR ALL TO authenticated
  USING (empresa_id = minha_empresa() OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (empresa_id = minha_empresa() OR public.has_role(auth.uid(), 'superadmin'));

DROP POLICY IF EXISTS "empresa autex" ON public.autex;
CREATE POLICY "empresa autex" ON public.autex FOR ALL TO authenticated
  USING (empresa_id = minha_empresa() OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (empresa_id = minha_empresa() OR public.has_role(auth.uid(), 'superadmin'));

DROP POLICY IF EXISTS "empresa motoristas" ON public.motoristas;
CREATE POLICY "empresa motoristas" ON public.motoristas FOR ALL TO authenticated
  USING (empresa_id = minha_empresa() OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (empresa_id = minha_empresa() OR public.has_role(auth.uid(), 'superadmin'));

DROP POLICY IF EXISTS "empresa patios" ON public.patios;
CREATE POLICY "empresa patios" ON public.patios FOR ALL TO authenticated
  USING (empresa_id = minha_empresa() OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (empresa_id = minha_empresa() OR public.has_role(auth.uid(), 'superadmin'));

DROP POLICY IF EXISTS "empresa veiculos" ON public.veiculos;
CREATE POLICY "empresa veiculos" ON public.veiculos FOR ALL TO authenticated
  USING (empresa_id = minha_empresa() OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (empresa_id = minha_empresa() OR public.has_role(auth.uid(), 'superadmin'));

DROP POLICY IF EXISTS "usuario le proprio vinculo" ON public.empresa_usuarios;
CREATE POLICY "usuario le proprio vinculo" ON public.empresa_usuarios FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

DROP POLICY IF EXISTS "admin gerencia empresas" ON public.empresas;
CREATE POLICY "admin gerencia empresas" ON public.empresas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));