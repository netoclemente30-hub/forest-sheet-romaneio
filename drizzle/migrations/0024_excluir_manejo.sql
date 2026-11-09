CREATE OR REPLACE FUNCTION public.excluir_manejo(_autex text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _emp uuid := public.minha_empresa();
BEGIN
  IF _emp IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin')) THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir manejos';
  END IF;
  IF EXISTS (SELECT 1 FROM public.toras WHERE empresa_id=_emp AND autex=_autex) THEN
    RAISE EXCEPTION 'Este manejo tem toras lançadas e não pode ser excluído';
  END IF;
  DELETE FROM public.mapas_exploracao WHERE empresa_id=_emp AND autex=_autex;
  DELETE FROM public.rastros_gps WHERE empresa_id=_emp AND autex=_autex;
  DELETE FROM public.arvores WHERE empresa_id=_emp AND autex=_autex;
  DELETE FROM public.autex WHERE empresa_id=_emp AND numero=_autex;
END $$;
REVOKE ALL ON FUNCTION public.excluir_manejo(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.excluir_manejo(text) TO authenticated;