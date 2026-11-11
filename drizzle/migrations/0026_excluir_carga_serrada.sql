CREATE OR REPLACE FUNCTION public.excluir_carga_serrada(_empresa uuid, _id uuid, _log jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE num text; qtd integer;
BEGIN
 IF auth.uid() IS NULL OR NOT (_empresa = public.minha_empresa() OR public.has_role(auth.uid(),'superadmin')) THEN RAISE EXCEPTION 'Empresa não autorizada'; END IF;
 SELECT numero_carga INTO num FROM public.romaneios_madeira_serrada WHERE id = _id AND empresa_id = _empresa FOR UPDATE;
 IF num IS NULL THEN RAISE EXCEPTION 'Carga não encontrada'; END IF;
 SELECT count(*) INTO qtd FROM public.romaneio_carga_pacotes WHERE romaneio_id = _id AND empresa_id = _empresa;
 DELETE FROM public.romaneio_carga_pacotes WHERE romaneio_id = _id AND empresa_id = _empresa;
 DELETE FROM public.romaneios_madeira_serrada WHERE id = _id AND empresa_id = _empresa;
 INSERT INTO public.registros(empresa_id,user_id,user_email,acao,detalhe,lat,lng,criado_em) VALUES(_empresa,auth.uid(),auth.jwt()->>'email','Carga de madeira serrada excluída',num||' · '||qtd||' pacotes devolvidos ao pátio',nullif(_log->>'lat','')::double precision,nullif(_log->>'lng','')::double precision,coalesce((_log->>'criado_em')::timestamptz,now()));
END $$;
REVOKE ALL ON FUNCTION public.excluir_carga_serrada(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.excluir_carga_serrada(uuid,uuid,jsonb) TO authenticated;