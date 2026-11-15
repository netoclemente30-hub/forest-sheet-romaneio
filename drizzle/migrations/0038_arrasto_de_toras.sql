-- Arrasto de toras da floresta ao pátio. Migration para homologação:
-- NÃO aplicar em produção sem autorização de uso do Lovable Cloud.
-- Nenhum dado existente é alterado; os novos campos começam nulos.
ALTER TABLE public.toras ADD COLUMN IF NOT EXISTS arrastada_em timestamptz;
ALTER TABLE public.toras ADD COLUMN IF NOT EXISTS arrastada_por uuid;
ALTER TABLE public.toras ADD COLUMN IF NOT EXISTS arrasto_operacao_id uuid;
ALTER TABLE public.toras ADD COLUMN IF NOT EXISTS arrasto_lat double precision;
ALTER TABLE public.toras ADD COLUMN IF NOT EXISTS arrasto_lng double precision;
CREATE INDEX IF NOT EXISTS toras_arrastadas_empresa_dia_idx
  ON public.toras (empresa_id, arrastada_em) WHERE arrastada_em IS NOT NULL;

-- O funcionário lança cada tora identificada por empresa, AUTEX, árvore e plaqueta.
-- A transação valida autorização, abate, GPS, concorrência e histórico de auditoria.
CREATE OR REPLACE FUNCTION public.registrar_arrasto_toras(
  _empresa uuid,
  _autex text,
  _arvore integer,
  _plaquetas integer[],
  _lat double precision,
  _lng double precision,
  _precisao double precision,
  _capturado_em timestamptz,
  _operacao uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  total integer;
  encontradas integer;
  previamente integer;
  mesma_operacao integer;
  abatida timestamptz;
  arvore_lat double precision;
  arvore_lng double precision;
  distancia_metros double precision;
  registro_id uuid;
  contexto_anterior text;
BEGIN
  IF auth.uid() IS NULL OR _empresa IS NULL OR
    NOT (_empresa = public.minha_empresa() OR public.has_role(auth.uid(),'superadmin'))
  THEN RAISE EXCEPTION 'Você não tem permissão nesta empresa'; END IF;

  total := cardinality(_plaquetas);
  IF _operacao IS NULL OR nullif(btrim(_autex),'') IS NULL OR _arvore IS NULL OR _arvore <= 0
     OR total IS NULL OR total < 1 OR total > 100
     OR total <> (SELECT count(DISTINCT p) FROM unnest(_plaquetas) AS p)
     OR EXISTS (SELECT 1 FROM unnest(_plaquetas) AS p WHERE p IS NULL OR p <= 0)
  THEN RAISE EXCEPTION 'Seleção de toras ou operação inválida'; END IF;

  IF _lat IS NULL OR _lng IS NULL OR _precisao IS NULL
    OR NOT (_lat BETWEEN -90 AND 90 AND _lng BETWEEN -180 AND 180)
    OR NOT (_precisao BETWEEN 0 AND 100)
  THEN RAISE EXCEPTION 'GPS inválido ou com precisão insuficiente'; END IF;

  -- Permite sincronização posterior da fila offline, mas rejeita relógios
  -- futuros e capturas com mais de 30 dias. O registro conserva o momento real.
  IF _capturado_em IS NULL OR _capturado_em > now() + interval '1 minute'
    OR _capturado_em < now() - interval '30 days'
  THEN RAISE EXCEPTION 'Data da captura GPS inválida ou muito antiga'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_empresa::text,0));
  SELECT a.abatida_em,a.latitude,a.longitude
    INTO abatida,arvore_lat,arvore_lng
  FROM public.arvores a
  WHERE a.empresa_id=_empresa AND a.autex=_autex AND a.numero=_arvore
  LIMIT 1 FOR SHARE;

  IF NOT FOUND OR abatida IS NULL
  THEN RAISE EXCEPTION 'Registre o abate da árvore antes do arrasto'; END IF;
  IF arvore_lat IS NULL OR arvore_lng IS NULL
  THEN RAISE EXCEPTION 'Localize a árvore no mapa antes do arrasto'; END IF;
  IF _capturado_em < abatida - interval '1 minute'
  THEN RAISE EXCEPTION 'O arrasto não pode ser anterior ao abate'; END IF;

  -- Distância aproximada em metros, sem necessidade da extensão PostGIS.
  distancia_metros := 111195 * sqrt(
    power(_lat-arvore_lat,2) +
    power((_lng-arvore_lng)*cos(radians(arvore_lat)),2)
  );
  IF distancia_metros > 100
  THEN RAISE EXCEPTION 'Tratorista a mais de 100 metros da árvore'; END IF;

  PERFORM 1 FROM public.toras
    WHERE empresa_id=_empresa AND plaqueta=ANY(_plaquetas)
    ORDER BY plaqueta FOR UPDATE;

  SELECT count(*),
    count(*) FILTER (WHERE arrastada_em IS NOT NULL),
    count(*) FILTER (WHERE arrasto_operacao_id=_operacao)
    INTO encontradas,previamente,mesma_operacao
  FROM public.toras
  WHERE empresa_id=_empresa AND autex=_autex
    AND arvore=_arvore AND origem='manejo'
    AND plaqueta=ANY(_plaquetas);

  IF encontradas <> total
  THEN RAISE EXCEPTION 'Há toras inexistentes ou não vinculadas à árvore/AUTEX'; END IF;
  IF previamente=total AND mesma_operacao=total THEN
    RETURN total;  -- Repetição idempotente após perda de conexão.
  END IF;
  IF previamente>0
  THEN RAISE EXCEPTION 'Uma ou mais toras já foram arrastadas; revise a lista'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.toras
    WHERE empresa_id=_empresa AND plaqueta=ANY(_plaquetas)
      AND (carregada OR romaneio_id IS NOT NULL)
  ) THEN RAISE EXCEPTION 'Tora já carregada para serraria não pode receber novo arrasto'; END IF;

  INSERT INTO public.registros (
    empresa_id,user_id,user_email,acao,detalhe,
    lat,lng,criado_em,operacao_id,mudancas
  ) VALUES (
    _empresa,auth.uid(),auth.jwt()->>'email','Arrasto concluído',
    'Árvore '||_arvore||' · AUTEX '||_autex||' · '||total||' tora(s) · plaquetas '||
      array_to_string(_plaquetas,', '),
    _lat,_lng,_capturado_em,_operacao,'[]'::jsonb
  ) RETURNING id INTO registro_id;

  contexto_anterior := current_setting('app.registro_contexto',true);
  PERFORM set_config('app.registro_contexto',registro_id::text,true);
  UPDATE public.toras SET
    arrastada_em=_capturado_em,
    arrastada_por=auth.uid(),
    arrasto_operacao_id=_operacao,
    arrasto_lat=_lat,
    arrasto_lng=_lng
  WHERE empresa_id=_empresa AND autex=_autex AND arvore=_arvore
    AND plaqueta=ANY(_plaquetas) AND origem='manejo'
    AND arrastada_em IS NULL AND NOT carregada AND romaneio_id IS NULL;
  GET DIAGNOSTICS encontradas = ROW_COUNT;
  IF encontradas<>total THEN
    RAISE EXCEPTION 'Falha ao registrar todas as toras; nenhum arrasto foi gravado';
  END IF;
  PERFORM set_config('app.registro_contexto',coalesce(contexto_anterior,''),true);
  RETURN encontradas;
END $$;

REVOKE ALL ON FUNCTION public.registrar_arrasto_toras(
  uuid,text,integer,integer[],double precision,double precision,
  double precision,timestamptz,uuid
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.registrar_arrasto_toras(
  uuid,text,integer,integer[],double precision,double precision,
  double precision,timestamptz,uuid
) TO authenticated;
