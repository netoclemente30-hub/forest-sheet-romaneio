CREATE OR REPLACE FUNCTION public.pode_fiscal(_empresa uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND _empresa IS NOT NULL AND (
    public.has_role(auth.uid(), 'superadmin')
    OR (EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.user_id = auth.uid() AND eu.empresa_id = _empresa)
      AND (public.has_role(auth.uid(), 'admin')
        OR EXISTS (SELECT 1 FROM public.funcoes_funcionarios f WHERE f.user_id = auth.uid() AND f.empresa_id = _empresa AND f.funcao = 'gerente_escritorio')))
  )
$$;
REVOKE ALL ON FUNCTION public.pode_fiscal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_fiscal(uuid) TO authenticated;