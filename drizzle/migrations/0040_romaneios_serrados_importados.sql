CREATE TABLE public.romaneios_serrados_importados (
 id uuid PRIMARY KEY,
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 cab jsonb NOT NULL,
 itens jsonb NOT NULL,
 total_pecas integer NOT NULL,
 total_volume_m3 numeric NOT NULL,
 revisao integer NOT NULL DEFAULT 1,
 ultima_operacao uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.romaneios_serrados_importados TO authenticated;
GRANT ALL ON public.romaneios_serrados_importados TO service_role;
ALTER TABLE public.romaneios_serrados_importados ENABLE ROW LEVEL SECURITY;
CREATE POLICY romaneios_importados_ler ON public.romaneios_serrados_importados FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'serraria_ver') OR public.pode_funcao(empresa_id,'informacoes_ver'));
CREATE OR REPLACE FUNCTION public.salvar_romaneio_serrado_importado(_empresa uuid, _id uuid, _revisao integer, _cab jsonb, _itens jsonb, _operacao uuid, _log jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE atual public.romaneios_serrados_importados; item jsonb; esp numeric; larg numeric; comp numeric; qtd numeric; pecas bigint := 0; vol numeric := 0; nova integer; antes jsonb;
BEGIN
 IF auth.uid() IS NULL OR _empresa IS NULL OR _id IS NULL OR _operacao IS NULL OR NOT public.pode_funcao(_empresa,'serraria_operar') THEN RAISE EXCEPTION 'Sem permissão para operar a serraria nesta empresa'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_id::text,0));
 SELECT * INTO atual FROM public.romaneios_serrados_importados WHERE id=_id FOR UPDATE;
 IF atual.id IS NOT NULL THEN
  IF atual.empresa_id<>_empresa THEN RAISE EXCEPTION 'Empresa não autorizada'; END IF;
  IF atual.ultima_operacao=_operacao THEN RETURN atual.revisao; END IF;
  IF atual.revisao<>_revisao THEN RAISE EXCEPTION 'Romaneio alterado em outro aparelho. Reabra antes de salvar'; END IF;
  antes := to_jsonb(atual);
 ELSIF _revisao<>0 THEN RAISE EXCEPTION 'Romaneio não encontrado'; END IF;
 IF jsonb_typeof(_cab)<>'object' OR NULLIF(trim(_cab->>'numero_carga'),'') IS NULL OR NULLIF(_cab->>'data','') IS NULL THEN RAISE EXCEPTION 'Informe número e data do romaneio'; END IF;
 PERFORM (_cab->>'data')::date;
 IF jsonb_typeof(_itens)<>'array' OR jsonb_array_length(_itens)<1 OR jsonb_array_length(_itens)>2000 THEN RAISE EXCEPTION 'Informe de 1 a 2000 linhas de peças'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(_itens) LOOP
  IF jsonb_typeof(item)<>'object' OR NULLIF(trim(item->>'especie'),'') IS NULL OR NULLIF(trim(item->>'tipo_peca'),'') IS NULL THEN RAISE EXCEPTION 'Preencha nome da madeira e tipo de peça'; END IF;
  esp := (item->>'grossura')::numeric; larg := (item->>'largura')::numeric; comp := (item->>'comprimento')::numeric; qtd := (item->>'quantidade')::numeric;
  IF esp IS NULL OR larg IS NULL OR comp IS NULL OR qtd IS NULL OR esp::text IN ('NaN','Infinity','-Infinity') OR larg::text IN ('NaN','Infinity','-Infinity') OR comp::text IN ('NaN','Infinity','-Infinity') OR qtd::text IN ('NaN','Infinity','-Infinity') OR esp<=0 OR esp>1000 OR larg<=0 OR larg>1000 OR comp<=0 OR comp>100 OR qtd<1 OR qtd<>trunc(qtd) OR qtd>1000000 THEN RAISE EXCEPTION 'Medidas positivas e quantidades inteiras são obrigatórias'; END IF;
  pecas := pecas+qtd::bigint; vol := vol+esp*larg*comp*qtd/10000;
 END LOOP;
 IF pecas>2147483647 THEN RAISE EXCEPTION 'Quantidade de peças excede o limite'; END IF;
 nova := coalesce(atual.revisao,0)+1;
 INSERT INTO public.romaneios_serrados_importados(id,empresa_id,cab,itens,total_pecas,total_volume_m3,revisao,ultima_operacao)
 VALUES (_id,_empresa,_cab,_itens,pecas,round(vol,4),nova,_operacao)
 ON CONFLICT(id) DO UPDATE SET cab=excluded.cab,itens=excluded.itens,total_pecas=excluded.total_pecas,total_volume_m3=excluded.total_volume_m3,revisao=excluded.revisao,ultima_operacao=excluded.ultima_operacao,atualizado_em=now();
 PERFORM public.registrar_evento(_empresa,coalesce(_log,'{}'::jsonb)||jsonb_build_object('operacao_id',_operacao,'acao',CASE WHEN atual.id IS NULL THEN 'Romaneio serrado importado' ELSE 'Romaneio importado editado' END,'detalhe',(_cab->>'numero_carga')||' · revisão '||nova||' · '||pecas||' peças · '||round(vol,4)||' m³'));
 RETURN nova;
END $$;
REVOKE ALL ON FUNCTION public.salvar_romaneio_serrado_importado(uuid,uuid,integer,jsonb,jsonb,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.salvar_romaneio_serrado_importado(uuid,uuid,integer,jsonb,jsonb,uuid,jsonb) TO authenticated;