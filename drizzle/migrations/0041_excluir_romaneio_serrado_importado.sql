CREATE OR REPLACE FUNCTION public.excluir_romaneio_serrado_importado(_empresa uuid, _id uuid, _log jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE num text; pecas integer; vol numeric;
BEGIN
 IF auth.uid() IS NULL OR _empresa IS NULL OR NOT public.pode_funcao(_empresa,'serraria_operar') THEN RAISE EXCEPTION 'Sem permissão para operar a serraria nesta empresa'; END IF;
 SELECT cab->>'numero_carga', total_pecas, total_volume_m3 INTO num, pecas, vol FROM public.romaneios_serrados_importados WHERE id=_id AND empresa_id=_empresa FOR UPDATE;
 IF num IS NULL THEN RAISE EXCEPTION 'Romaneio não encontrado'; END IF;
 DELETE FROM public.romaneios_serrados_importados WHERE id=_id AND empresa_id=_empresa;
 PERFORM public.registrar_evento(_empresa,coalesce(_log,'{}'::jsonb)||jsonb_build_object('acao','Romaneio importado excluído','detalhe',num||' · '||pecas||' peças · '||vol||' m³'));
END $$;
REVOKE ALL ON FUNCTION public.excluir_romaneio_serrado_importado(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.excluir_romaneio_serrado_importado(uuid,uuid,jsonb) TO authenticated;