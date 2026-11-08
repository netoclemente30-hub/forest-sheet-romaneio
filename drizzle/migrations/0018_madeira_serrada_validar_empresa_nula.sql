DO $$
DECLARE assinatura text; definicao text;
BEGIN
 FOREACH assinatura IN ARRAY ARRAY['public.salvar_pacote_serrado(uuid,uuid,jsonb,jsonb,jsonb)','public.excluir_pacote_serrado(uuid,uuid,jsonb)','public.salvar_carga_serrada(uuid,uuid,jsonb,uuid[],jsonb)'] LOOP
  definicao := pg_get_functiondef(assinatura::regprocedure);
  IF position('NOT (_empresa = public.minha_empresa() OR public.has_role(auth.uid(),''superadmin''))' in definicao) = 0 THEN RAISE EXCEPTION 'Validação esperada não encontrada'; END IF;
  definicao := replace(definicao,'NOT (_empresa = public.minha_empresa() OR public.has_role(auth.uid(),''superadmin''))','_empresa IS NULL OR NOT coalesce((_empresa = public.minha_empresa() OR public.has_role(auth.uid(),''superadmin'')),false)');
  EXECUTE definicao;
 END LOOP;
END $$;