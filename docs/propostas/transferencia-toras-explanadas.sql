-- PROPOSTA PARA LOVABLE CLOUD: sem alterações destrutivas.
-- RPC de transferência individual de tora entre explanadas do MESMO manejo e empresa.
-- Garante operação atômica, idempotente e auditável, inclusive após retry offline.
-- Aplicar pelo banco gerenciado pela Lovable, não na pasta drizzle/migrations.
CREATE OR REPLACE FUNCTION public.transferir_tora_explanada(
  _empresa uuid, _autex text, _plaqueta integer,
  _origem uuid, _destino uuid, _operacao uuid, _log jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  tora_atual public.toras%ROWTYPE;
  registro_ja public.registros%ROWTYPE;
  origem_nome text;
  destino_nome text;
  registro_novo uuid;
  contexto_anterior text;
  capturado timestamptz;
  mudanca jsonb;
BEGIN
  IF auth.uid() IS NULL OR _empresa IS NULL
     OR NOT public.pode_funcao(_empresa, 'toras_lancar')
  THEN RAISE EXCEPTION 'Sem permissão para transferir toras da empresa'; END IF;
  IF _operacao IS NULL OR _plaqueta IS NULL OR _plaqueta <= 0
     OR NULLIF(BTRIM(_autex), '') IS NULL
     OR _origem IS NULL OR _destino IS NULL OR _origem = _destino
  THEN RAISE EXCEPTION 'Informe uma tora, a origem e um destino diferente'; END IF;
  IF _log IS NULL OR jsonb_typeof(_log) <> 'object'
  THEN RAISE EXCEPTION 'Dados de auditoria ausentes'; END IF;
  capturado := COALESCE(NULLIF(_log->>'criado_em','')::timestamptz,now());
  IF capturado > now() + interval '5 minutes'
     OR capturado < now() - interval '180 days'
  THEN RAISE EXCEPTION 'Data do lançamento inválida'; END IF;

  -- Serializa transferências concorrentes da mesma plaqueta, sem afetar outras árvores.
  PERFORM pg_advisory_xact_lock(hashtextextended(_empresa::text || ':' || _plaqueta::text, 0));

  SELECT * INTO registro_ja FROM public.registros
  WHERE empresa_id=_empresa AND operacao_id=_operacao
  LIMIT 1;
  IF FOUND THEN
    mudanca := registro_ja.mudancas->0;
    IF registro_ja.acao='Transferência entre explanadas'
       AND mudanca->>'tabela'='toras'
       AND mudanca->'antes'->>'plaqueta'=_plaqueta::text
       AND mudanca->'antes'->>'autex'=_autex
       AND mudanca->'antes'->>'arrasto_explanada_id'=_origem::text
       AND mudanca->'depois'->>'arrasto_explanada_id'=_destino::text
    THEN RETURN registro_ja.id; END IF;
    RAISE EXCEPTION 'ID de operação já utilizado para outro lançamento';
  END IF;

  SELECT nome INTO origem_nome FROM public.explanadas
  WHERE empresa_id=_empresa AND autex=_autex AND id=_origem;
  IF NOT FOUND THEN RAISE EXCEPTION 'Explanada de origem não pertence à empresa/AUTEX'; END IF;

  SELECT nome INTO destino_nome FROM public.explanadas
  WHERE empresa_id=_empresa AND autex=_autex AND id=_destino;
  IF NOT FOUND THEN RAISE EXCEPTION 'Destino não pertence à mesma empresa/AUTEX'; END IF;

  SELECT * INTO tora_atual FROM public.toras
  WHERE empresa_id=_empresa AND autex=_autex AND plaqueta=_plaqueta
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tora não encontrada nesta empresa/AUTEX'; END IF;
  IF tora_atual.origem IS DISTINCT FROM 'manejo'
     OR tora_atual.arrastada_em IS NULL
  THEN RAISE EXCEPTION 'Somente toras de manejo arrastadas podem ser transferidas'; END IF;
  IF tora_atual.arrasto_explanada_id IS DISTINCT FROM _origem
  THEN RAISE EXCEPTION 'A tora não está mais na explanada de origem. Atualize a lista'; END IF;
  IF tora_atual.carregada OR tora_atual.romaneio_id IS NOT NULL
     OR tora_atual.serrada_em IS NOT NULL
  THEN RAISE EXCEPTION 'Tora carregada ou serrada não pode ser transferida'; END IF;

  INSERT INTO public.registros (
    empresa_id,user_id,user_email,acao,detalhe,lat,lng,criado_em,
    operacao_id,mudancas,aparelho_nome,aparelho_modelo,aparelho_ua
  ) VALUES (
    _empresa,auth.uid(),auth.jwt()->>'email','Transferência entre explanadas',
    'Plaqueta '||_plaqueta||' · árvore '||tora_atual.arvore||' · AUTEX '||_autex||
      ' · '||origem_nome||' → '||destino_nome,
    NULLIF(_log->>'lat','')::double precision,
    NULLIF(_log->>'lng','')::double precision,
    capturado,_operacao,'[]'::jsonb,
    _log->>'aparelho_nome',_log->>'aparelho_modelo',_log->>'aparelho_ua'
  ) RETURNING id INTO registro_novo;

  contexto_anterior := current_setting('app.registro_contexto',true);
  PERFORM set_config('app.registro_contexto',registro_novo::text,true);
  UPDATE public.toras SET arrasto_explanada_id=_destino
  WHERE empresa_id=_empresa AND autex=_autex AND plaqueta=_plaqueta
    AND arrasto_explanada_id=_origem
    AND origem='manejo' AND arrastada_em IS NOT NULL
    AND NOT carregada AND romaneio_id IS NULL AND serrada_em IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transferência não foi concluída'; END IF;
  PERFORM set_config('app.registro_contexto',COALESCE(contexto_anterior,''),true);
  RETURN registro_novo;
END $$;

REVOKE ALL ON FUNCTION public.transferir_tora_explanada(
  uuid,text,integer,uuid,uuid,uuid,jsonb
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.transferir_tora_explanada(
  uuid,text,integer,uuid,uuid,uuid,jsonb
) TO authenticated;
