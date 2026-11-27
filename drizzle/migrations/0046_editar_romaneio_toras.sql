CREATE OR REPLACE FUNCTION public.editar_romaneio_toras(_empresa uuid, _id uuid, _cab jsonb, _plaquetas integer[], _operacao uuid, _log jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  rid uuid;
  id_rom uuid;
  qtd integer;
  vol numeric;
  encontradas integer;
  invalidas integer;
  operacao_empresa uuid;
BEGIN
  IF auth.uid() IS NULL OR _empresa IS NULL OR _id IS NULL OR _operacao IS NULL
     OR NOT public.pode_funcao(_empresa, 'carga_criar') THEN
    RAISE EXCEPTION 'Apenas motorista autorizado ou administrador pode editar carga nesta empresa';
  END IF;
  IF COALESCE(cardinality(_plaquetas), 0) = 0
     OR cardinality(_plaquetas) <> (SELECT count(DISTINCT p) FROM unnest(_plaquetas) p) THEN
    RAISE EXCEPTION 'Selecione toras sem repetição';
  END IF;
  IF NULLIF(trim(coalesce(_cab->>'placa', '')), '') IS NULL THEN
    RAISE EXCEPTION 'Placa obrigatória';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_empresa::text, 0));

  SELECT empresa_id INTO operacao_empresa
    FROM public.registros WHERE operacao_id = _operacao;
  IF operacao_empresa IS NOT NULL THEN
    IF operacao_empresa <> _empresa THEN
      RAISE EXCEPTION 'Operação já vinculada a outra empresa';
    END IF;
    RETURN _id;
  END IF;

  SELECT id INTO id_rom FROM public.romaneios
    WHERE id = _id AND empresa_id = _empresa FOR UPDATE;
  IF id_rom IS NULL THEN
    RAISE EXCEPTION 'Romaneio não encontrado nesta empresa';
  END IF;
  IF EXISTS (SELECT 1 FROM public.romaneios WHERE id = id_rom AND recebido_em IS NOT NULL) THEN
    RAISE EXCEPTION 'Carga já recebida no pátio; não pode mais ser editada';
  END IF;

  PERFORM 1 FROM public.toras
    WHERE empresa_id = _empresa
      AND (romaneio_id = id_rom OR plaqueta = ANY(_plaquetas))
    ORDER BY plaqueta FOR UPDATE;

  IF EXISTS (SELECT 1 FROM public.toras
    WHERE empresa_id = _empresa AND romaneio_id = id_rom AND serrada_em IS NOT NULL) THEN
    RAISE EXCEPTION 'Não é possível editar uma carga com toras já serradas';
  END IF;

  SELECT count(*), coalesce(sum(volume), 0), count(*) FILTER (
    WHERE serrada_em IS NOT NULL
      OR (romaneio_id IS NOT NULL AND romaneio_id <> id_rom)
      OR (carregada AND romaneio_id IS DISTINCT FROM id_rom)
  ) INTO encontradas, vol, invalidas
    FROM public.toras WHERE empresa_id = _empresa AND plaqueta = ANY(_plaquetas);
  qtd := cardinality(_plaquetas);
  IF encontradas <> qtd THEN
    RAISE EXCEPTION 'Há toras inexistentes ou de outra empresa';
  END IF;
  IF invalidas > 0 THEN
    RAISE EXCEPTION 'Uma ou mais toras já estão em outra carga ou foram serradas';
  END IF;

  INSERT INTO public.registros (
    empresa_id, user_id, user_email, acao, detalhe, criado_em,
    lat, lng, operacao_id, mudancas
  ) VALUES (
    _empresa, auth.uid(), auth.jwt()->>'email', 'Romaneio editado',
    qtd || ' toras · ' || round(vol, 4) || ' m³ · placa ' || (_cab->>'placa'),
    coalesce(NULLIF(_log->>'criado_em', '')::timestamptz, now()),
    NULLIF(_log->>'lat', '')::double precision,
    NULLIF(_log->>'lng', '')::double precision,
    _operacao, '[]'::jsonb
  ) RETURNING id INTO rid;
  PERFORM set_config('app.registro_contexto', rid::text, true);

  UPDATE public.toras SET carregada = false, romaneio_id = NULL
    WHERE empresa_id = _empresa AND romaneio_id = id_rom
      AND plaqueta <> ALL(_plaquetas);

  UPDATE public.toras SET carregada = true, romaneio_id = id_rom
    WHERE empresa_id = _empresa AND plaqueta = ANY(_plaquetas);
  GET DIAGNOSTICS encontradas = ROW_COUNT;
  IF encontradas <> qtd THEN
    RAISE EXCEPTION 'Falha ao vincular todas as toras; transação revertida';
  END IF;

  UPDATE public.romaneios SET
    placa = upper(trim(_cab->>'placa')),
    julieta = upper(trim(coalesce(_cab->>'julieta', ''))),
    motorista = trim(coalesce(_cab->>'motorista', '')),
    cpf = trim(coalesce(_cab->>'cpf', '')),
    data = coalesce(NULLIF(_cab->>'data', '')::date, current_date),
    cliente = CASE WHEN jsonb_typeof(_cab->'cliente') = 'object' THEN _cab->'cliente' ELSE NULL END,
    total_volume = vol,
    qtd_toras = qtd
    WHERE id = id_rom AND empresa_id = _empresa;

  PERFORM set_config('app.registro_contexto', '', true);
  RETURN id_rom;
END
$function$;

REVOKE ALL ON FUNCTION public.editar_romaneio_toras(uuid, uuid, jsonb, integer[], uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.editar_romaneio_toras(uuid, uuid, jsonb, integer[], uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.editar_romaneio_toras(uuid, uuid, jsonb, integer[], uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.editar_romaneio_toras(uuid, uuid, jsonb, integer[], uuid, jsonb) TO service_role;
