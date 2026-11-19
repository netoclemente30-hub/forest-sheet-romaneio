ALTER TABLE public.romaneios ADD COLUMN IF NOT EXISTS cliente jsonb;
CREATE OR REPLACE FUNCTION public.salvar_romaneio_toras(_empresa uuid, _cab jsonb, _plaquetas integer[], _operacao uuid, _log jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE rid uuid; id_rom uuid; qtd integer; vol numeric; encontradas integer; invalidas integer;
BEGIN
  IF auth.uid() IS NULL OR _empresa IS NULL OR _operacao IS NULL OR NOT public.pode_funcao(_empresa,'carga_criar')
  THEN RAISE EXCEPTION 'Apenas motorista autorizado ou administrador pode criar carga nesta empresa'; END IF;
  IF COALESCE(cardinality(_plaquetas),0)=0 OR cardinality(_plaquetas)<>(SELECT count(DISTINCT p) FROM unnest(_plaquetas) p)
  THEN RAISE EXCEPTION 'Selecione toras sem repetição'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_empresa::text,0));
  SELECT id INTO id_rom FROM public.romaneios WHERE operacao_id = _operacao;
  IF id_rom IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.romaneios WHERE id=id_rom AND empresa_id=_empresa) THEN RAISE EXCEPTION 'Operação já vinculada a outra empresa'; END IF;
    RETURN id_rom;
  END IF;
  PERFORM 1 FROM public.toras WHERE empresa_id=_empresa AND plaqueta=ANY(_plaquetas) ORDER BY plaqueta FOR UPDATE;
  SELECT count(*), coalesce(sum(volume),0), count(*) FILTER (WHERE carregada OR romaneio_id IS NOT NULL OR serrada_em IS NOT NULL)
    INTO encontradas, vol, invalidas FROM public.toras WHERE empresa_id=_empresa AND plaqueta=ANY(_plaquetas);
  qtd := cardinality(_plaquetas);
  IF encontradas <> qtd THEN RAISE EXCEPTION 'Há toras inexistentes ou de outra empresa'; END IF;
  IF invalidas > 0 THEN RAISE EXCEPTION 'Uma ou mais toras já foram carregadas'; END IF;
  IF NULLIF(trim(coalesce(_cab->>'placa','')),'') IS NULL THEN RAISE EXCEPTION 'Placa obrigatória'; END IF;
  INSERT INTO public.romaneios (empresa_id,placa,julieta,motorista,cpf,data,total_volume,qtd_toras,created_by,operacao_id,cliente)
  VALUES (_empresa,upper(trim(_cab->>'placa')),upper(trim(coalesce(_cab->>'julieta',''))),trim(coalesce(_cab->>'motorista','')),trim(coalesce(_cab->>'cpf','')),
    coalesce(NULLIF(_cab->>'data','')::date,current_date),vol,qtd,auth.uid(),_operacao,
    CASE WHEN jsonb_typeof(_cab->'cliente')='object' THEN _cab->'cliente' END)
  RETURNING id INTO id_rom;
  INSERT INTO public.registros (empresa_id,user_id,user_email,acao,detalhe,criado_em,lat,lng,operacao_id,mudancas)
  VALUES (_empresa,auth.uid(),auth.jwt()->>'email','Romaneio salvo',qtd||' toras · '||round(vol,4)||' m³ · placa '||(_cab->>'placa'),
    coalesce(NULLIF(_log->>'criado_em','')::timestamptz,now()),NULLIF(_log->>'lat','')::double precision,NULLIF(_log->>'lng','')::double precision,_operacao,'[]'::jsonb)
  RETURNING id INTO rid;
  PERFORM set_config('app.registro_contexto',rid::text,true);
  UPDATE public.toras SET carregada=true, romaneio_id=id_rom WHERE empresa_id=_empresa AND plaqueta=ANY(_plaquetas) AND NOT carregada AND romaneio_id IS NULL;
  GET DIAGNOSTICS encontradas = ROW_COUNT;
  IF encontradas <> qtd THEN RAISE EXCEPTION 'Falha ao vincular todas as toras; transação revertida'; END IF;
  PERFORM set_config('app.registro_contexto','',true);
  RETURN id_rom;
END $function$;