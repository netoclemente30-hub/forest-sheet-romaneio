DROP POLICY "todos leem empresas" ON public.empresas;

CREATE POLICY "usuario le a propria empresa" ON public.empresas FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.empresa_id = id AND eu.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'superadmin')
  );