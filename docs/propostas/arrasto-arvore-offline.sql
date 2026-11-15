-- Arrasto de árvore inteira ANTES do traçamento, independente da ordem de sincronização.
-- Migração aditiva preparada para execução pelo conector Lovable, sob autorização.
-- Não altera abatimentos existentes e não cria abates fictícios.

CREATE TABLE IF NOT EXISTS public.arrastos_arvores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  autex text NOT NULL,
  arvore integer NOT NULL,
  explanada_id uuid,
  capturado_em timestamptz NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  gps_precisao double precision NOT NULL,
  operacao_id uuid NOT NULL UNIQUE,
  realizado_por uuid NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT arrastos_arvores_uma_por_arvore UNIQUE (empresa_id,autex,arvore),
  CONSTRAINT arrastos_arvores_arvore_fkey FOREIGN KEY (empresa_id,arvore,autex)
    REFERENCES public.arvores(empresa_id,numero,autex),
  CONSTRAINT arrastos_arvores_explanada_fkey FOREIGN KEY (empresa_id,autex,explanada_id)
    REFERENCES public.explanadas(empresa_id,autex,id),
  CONSTRAINT arrastos_arvores_gps_valido CHECK (
    latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
    AND gps_precisao BETWEEN 0 AND 100
  )
);

REVOKE ALL ON public.arrastos_arvores FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.arrastos_arvores TO authenticated;
GRANT ALL ON public.arrastos_arvores TO service_role;
ALTER TABLE public.arrastos_arvores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "arrastos arvores consulta" ON public.arrastos_arvores;
CREATE POLICY "arrastos arvores consulta" ON public.arrastos_arvores
FOR SELECT TO authenticated
USING (public.pode_funcao(empresa_id, 'mapa_ver') OR public.pode_funcao(empresa_id, 'informacoes_ver'));

CREATE INDEX IF NOT EXISTS arrastos_arvores_por_dia_idx
  ON public.arrastos_arvores (empresa_id,capturado_em);

-- SECURITY DEFINER autentica e valida o cargo novamente na nuvem.
-- O cortador e o tratorista podem estar OFFLINE ao mesmo tempo: não é exigido
-- abatida_em no momento da sincronização do arrasto.
CREATE OR REPLACE FUNCTION public.registrar_arrasto_arvore(
  _empresa uuid, _autex text, _arvore integer, _explanada uuid,
  _lat double precision, _lng double precision,
  _precisao double precision, _capturado_em timestamptz, _operacao uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  a public.arvores;
  existente public.arrastos_arvores;
  nova uuid;
  distancia_m double precision;
  registro uuid;
  contexto_anterior text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_funcao(_empresa,'mapa_arrastar')
  THEN RAISE EXCEPTION 'Cargo sem permissão para registrar arrasto de árvore'; END IF;

  IF _empresa IS NULL OR nullif(btrim(_autex),'') IS NULL OR _arvore IS NULL OR _arvore <= 0
    OR _operacao IS NULL OR _lat IS NULL OR _lng IS NULL OR _precisao IS NULL
    OR NOT (_lat BETWEEN -90 AND 90 AND _lng BETWEEN -180 AND 180 AND _precisao BETWEEN 0 AND 100)
  THEN RAISE EXCEPTION 'Dados da árvore ou GPS inválidos'; END IF;

  IF _capturado_em IS NULL OR _capturado_em > now() + interval '5 minutes'
    OR _capturado_em < now() - interval '180 days'
  THEN RAISE EXCEPTION 'Data da captura GPS inválida ou muito antiga'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_empresa::text || ':' || _autex || ':' || _arvore::text,0));

  SELECT * INTO existente FROM public.arrastos_arvores WHERE operacao_id=_operacao;
  IF FOUND THEN
    IF existente.empresa_id=_empresa AND existente.autex=_autex AND existente.arvore=_arvore
      AND existente.explanada_id IS NOT DISTINCT FROM _explanada
      AND existente.latitude=_lat AND existente.longitude=_lng
    THEN RETURN existente.id; END IF;
    RAISE EXCEPTION 'ID de operação reutilizado com dados diferentes';
  END IF;

  SELECT * INTO a FROM public.arvores
  WHERE empresa_id=_empresa AND autex=_autex AND numero=_arvore
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Árvore ausente desta empresa/AUTEX'; END IF;
  IF a.latitude IS NULL OR a.longitude IS NULL
  THEN RAISE EXCEPTION 'Árvore sem coordenadas: localize-a primeiro com GPS'; END IF;
  IF a.nao_abatida_motivo IS NOT NULL
  THEN RAISE EXCEPTION 'Árvore marcada como não abatida: aguarde conciliação do cadastro'; END IF;

  distancia_m := 111195 * sqrt(
    power(_lat-a.latitude,2)+power((_lng-a.longitude)*cos(radians(a.latitude)),2)
  );
  IF distancia_m > 100
  THEN RAISE EXCEPTION 'Tratorista a mais de 100 metros da árvore'; END IF;

  IF _explanada IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.explanadas
    WHERE id=_explanada AND empresa_id=_empresa AND autex=_autex
  ) THEN RAISE EXCEPTION 'Explanada de outra empresa ou AUTEX'; END IF;

  IF EXISTS (SELECT 1 FROM public.arrastos_arvores
    WHERE empresa_id=_empresa AND autex=_autex AND arvore=_arvore)
  THEN RAISE EXCEPTION 'Esta árvore já possui arrasto registrado'; END IF;

  INSERT INTO public.arrastos_arvores(
    empresa_id,autex,arvore,explanada_id,capturado_em,latitude,longitude,
    gps_precisao,operacao_id,realizado_por
  ) VALUES (
    _empresa,_autex,_arvore,_explanada,_capturado_em,_lat,_lng,
    _precisao,_operacao,auth.uid()
  ) RETURNING id INTO nova;

  INSERT INTO public.registros(
    empresa_id,user_id,user_email,acao,detalhe,lat,lng,criado_em,operacao_id,mudancas
  ) VALUES (
    _empresa,auth.uid(),auth.jwt()->>'email','Arrasto de árvore registrado',
    'Árvore '||_arvore||' · AUTEX '||_autex||
      ' · '||CASE WHEN _explanada IS NULL THEN 'destino pendente' ELSE 'explanada '||_explanada::text END,
    _lat,_lng,_capturado_em,_operacao,'[]'::jsonb
  ) RETURNING id INTO registro;

  -- Se o romaneador já lançou toras, herdar arrasto somente nas ainda elegíveis.
  contexto_anterior:=current_setting('app.registro_contexto',true);
  PERFORM set_config('app.registro_contexto',registro::text,true);
  UPDATE public.toras
  SET arrastada_em=_capturado_em, arrastada_por=auth.uid(),
      arrasto_operacao_id=_operacao, arrasto_lat=_lat, arrasto_lng=_lng,
      arrasto_explanada_id=_explanada
  WHERE empresa_id=_empresa AND autex=_autex AND arvore=_arvore
    AND origem='manejo' AND arrastada_em IS NULL AND NOT carregada
    AND romaneio_id IS NULL;
  PERFORM set_config('app.registro_contexto',coalesce(contexto_anterior,''),true);

  RETURN nova;
END $$;
REVOKE ALL ON FUNCTION public.registrar_arrasto_arvore(
  uuid,text,integer,uuid,double precision,double precision,double precision,timestamptz,uuid
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.registrar_arrasto_arvore(
  uuid,text,integer,uuid,double precision,double precision,double precision,timestamptz,uuid
) TO authenticated;

-- Ao traçar a árvore já arrastada, a tora herda automaticamente o evento real.
CREATE OR REPLACE FUNCTION public.herdar_arrasto_arvore_para_tora()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE a public.arrastos_arvores;
BEGIN
  IF NEW.origem IS DISTINCT FROM 'manejo' OR NEW.arrastada_em IS NOT NULL
  THEN RETURN NEW; END IF;

  SELECT * INTO a FROM public.arrastos_arvores
  WHERE empresa_id=NEW.empresa_id AND autex=NEW.autex AND arvore=NEW.arvore;

  IF FOUND THEN
    NEW.arrastada_em:=a.capturado_em;
    NEW.arrastada_por:=a.realizado_por;
    NEW.arrasto_operacao_id:=a.operacao_id;
    NEW.arrasto_lat:=a.latitude;
    NEW.arrasto_lng:=a.longitude;
    NEW.arrasto_explanada_id:=a.explanada_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS herdar_arrasto_arvore_tora ON public.toras;
CREATE TRIGGER herdar_arrasto_arvore_tora
BEFORE INSERT ON public.toras FOR EACH ROW
EXECUTE FUNCTION public.herdar_arrasto_arvore_para_tora();
