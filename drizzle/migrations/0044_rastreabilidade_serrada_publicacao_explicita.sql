ALTER TABLE public.pacotes_serrados
 ADD COLUMN toras_origem uuid[] NOT NULL DEFAULT '{}',
 ADD COLUMN crv_percentual numeric,
 ADD COLUMN pmfs text,
 ADD COLUMN poa text,
 ADD COLUMN publico_id uuid UNIQUE,
 ADD CONSTRAINT pacotes_serrados_crv_percentual_range CHECK (crv_percentual >= 0 AND crv_percentual <= 100);
ALTER TABLE public.romaneios_madeira_serrada ADD COLUMN publico_id uuid UNIQUE;
COMMENT ON COLUMN public.pacotes_serrados.toras_origem IS 'Referências a toras.publico_id da mesma empresa; não realiza baixa ou altera estoque.';
COMMENT ON COLUMN public.pacotes_serrados.publico_id IS 'Token público opcional, criado apenas pela publicação explícita.';
COMMENT ON COLUMN public.romaneios_madeira_serrada.publico_id IS 'Token público opcional, criado apenas pela publicação explícita.';

CREATE OR REPLACE FUNCTION public.salvar_pacote_serrado(_empresa uuid, _id uuid, _cab jsonb, _itens jsonb, _log jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE item jsonb; origens uuid[]; qtd bigint; crv numeric;
BEGIN
 IF NOT public.pode_funcao(_empresa, 'serraria_operar') THEN RAISE EXCEPTION 'Cargo sem permissão para operar a serraria'; END IF;
 IF auth.uid() IS NULL OR _empresa IS NULL OR NOT coalesce((_empresa = public.minha_empresa() OR public.has_role(auth.uid(),'superadmin')),false) THEN RAISE EXCEPTION 'Empresa não autorizada'; END IF;
 IF _cab ? 'publico_id' THEN RAISE EXCEPTION 'publico_id não pode ser informado no cadastro; use a publicação explícita'; END IF;
 IF trim(coalesce(_cab->>'numero','')) = '' OR jsonb_typeof(_itens) <> 'array' OR jsonb_array_length(_itens) = 0 THEN RAISE EXCEPTION 'Informe número e bitolas do pacote'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_id::text,0));
 IF nullif(_log->>'operacao_id','') IS NOT NULL AND EXISTS(SELECT 1 FROM public.registros WHERE empresa_id=_empresa AND operacao_id=(_log->>'operacao_id')::uuid AND acao='Pacote de madeira serrada salvo') THEN RETURN _id; END IF;
 PERFORM 1 FROM public.pacotes_serrados WHERE id = _id FOR UPDATE;
 IF coalesce((_cab->>'offline_criacao')::boolean,false) AND EXISTS(SELECT 1 FROM public.pacotes_serrados WHERE id=_id) THEN RAISE EXCEPTION 'Pacote já existe na nuvem. Atualize antes de alterar para preservar alterações recentes'; END IF;
 IF EXISTS(SELECT 1 FROM public.pacotes_serrados WHERE id = _id AND empresa_id <> _empresa) THEN RAISE EXCEPTION 'Pacote de outra empresa'; END IF;
 IF EXISTS(SELECT 1 FROM public.romaneio_carga_pacotes WHERE pacote_id = _id) THEN RAISE EXCEPTION 'Pacote já expedido não pode ser alterado'; END IF;
 IF _cab ? 'toras_origem' THEN
   IF jsonb_typeof(_cab->'toras_origem') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'toras_origem deve ser uma lista de UUIDs'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(_cab->'toras_origem') v WHERE jsonb_typeof(v) IS DISTINCT FROM 'string') THEN RAISE EXCEPTION 'toras_origem aceita somente UUIDs não nulos'; END IF;
   SELECT coalesce(array_agg(v::uuid), '{}'::uuid[]) INTO origens FROM jsonb_array_elements_text(_cab->'toras_origem') v;
   IF cardinality(origens) <> (SELECT count(DISTINCT x) FROM unnest(origens) x) THEN RAISE EXCEPTION 'toras_origem contém UUIDs duplicados'; END IF;
   PERFORM 1 FROM public.toras t WHERE t.empresa_id=_empresa AND t.publico_id=ANY(origens) ORDER BY t.plaqueta FOR SHARE;
   SELECT count(*) INTO qtd FROM public.toras t WHERE t.empresa_id=_empresa AND t.publico_id=ANY(origens);
   IF qtd <> cardinality(origens) THEN RAISE EXCEPTION 'Toras de origem inexistentes, ambíguas ou de outra empresa'; END IF;
 END IF;
 IF _cab ? 'crv_percentual' THEN
   IF _cab->'crv_percentual' <> 'null'::jsonb AND jsonb_typeof(_cab->'crv_percentual') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'CRV deve ser numérico entre 0 e 100'; END IF;
   crv := (_cab->>'crv_percentual')::numeric;
   IF crv < 0 OR crv > 100 THEN RAISE EXCEPTION 'CRV deve estar entre 0 e 100'; END IF;
 END IF;
 IF (_cab ? 'pmfs' AND jsonb_typeof(_cab->'pmfs') NOT IN ('string','null')) OR (_cab ? 'poa' AND jsonb_typeof(_cab->'poa') NOT IN ('string','null')) THEN RAISE EXCEPTION 'PMFS e POA devem ser texto ou nulos'; END IF;
 INSERT INTO public.pacotes_serrados(id,empresa_id,numero,data,observacoes,autex) VALUES(_id,_empresa,trim(_cab->>'numero'),(_cab->>'data')::date,coalesce(_cab->>'observacoes',''),trim(coalesce(_cab->>'autex',''))) ON CONFLICT(id) DO UPDATE SET numero = EXCLUDED.numero, data = EXCLUDED.data, observacoes = EXCLUDED.observacoes, autex = EXCLUDED.autex;
 UPDATE public.pacotes_serrados SET
   toras_origem=CASE WHEN _cab ? 'toras_origem' THEN origens ELSE toras_origem END,
   crv_percentual=CASE WHEN _cab ? 'crv_percentual' THEN crv ELSE crv_percentual END,
   pmfs=CASE WHEN _cab ? 'pmfs' THEN _cab->>'pmfs' ELSE pmfs END,
   poa=CASE WHEN _cab ? 'poa' THEN _cab->>'poa' ELSE poa END
 WHERE id=_id AND empresa_id=_empresa;
 DELETE FROM public.itens_pacote_serrado WHERE pacote_id = _id AND empresa_id = _empresa;
 FOR item IN SELECT * FROM jsonb_array_elements(_itens) LOOP
 INSERT INTO public.itens_pacote_serrado(empresa_id,pacote_id,especie,tipo_peca,grossura,largura,distribuicao_pecas) VALUES(_empresa,_id,trim(item->>'especie'),trim(item->>'tipo_peca'),(item->>'grossura')::numeric,(item->>'largura')::numeric,item->'distribuicao_pecas');
 END LOOP;
 INSERT INTO public.registros(empresa_id,user_id,user_email,acao,detalhe,lat,lng,criado_em,operacao_id) VALUES(_empresa,auth.uid(),auth.jwt()->>'email','Pacote de madeira serrada salvo','Pacote '||(_cab->>'numero'),nullif(_log->>'lat','')::double precision,nullif(_log->>'lng','')::double precision,coalesce((_log->>'criado_em')::timestamptz,now()),nullif(_log->>'operacao_id','')::uuid);
 RETURN _id;
END $function$;

CREATE FUNCTION public.publicar_rastreabilidade_serrada(_empresa uuid,_tipo text,_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE token uuid;
BEGIN
 IF auth.uid() IS NULL OR _empresa IS NULL OR NOT public.pode_funcao(_empresa,'serraria_operar') OR NOT coalesce((_empresa=public.minha_empresa() OR public.has_role(auth.uid(),'superadmin')),false) THEN RAISE EXCEPTION 'Empresa ou cargo não autorizado'; END IF;
 IF _tipo IS NULL OR _tipo NOT IN ('pacote','carga') OR _id IS NULL THEN RAISE EXCEPTION 'Informe tipo exato pacote/carga e identificador'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(_id::text,0));
 IF _tipo='pacote' THEN
   SELECT p.publico_id INTO token FROM public.pacotes_serrados p WHERE p.empresa_id=_empresa AND p.id=_id FOR UPDATE;
 ELSE
   SELECT r.publico_id INTO token FROM public.romaneios_madeira_serrada r WHERE r.empresa_id=_empresa AND r.id=_id FOR UPDATE;
 END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'Registro inexistente ou de outra empresa'; END IF;
 IF token IS NOT NULL THEN RETURN token; END IF;
 LOOP
   token:=pg_catalog.gen_random_uuid();
   PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(token::text,1));
   EXIT WHEN NOT EXISTS(SELECT 1 FROM public.pacotes_serrados p WHERE p.publico_id=token) AND NOT EXISTS(SELECT 1 FROM public.romaneios_madeira_serrada r WHERE r.publico_id=token);
 END LOOP;
 IF _tipo='pacote' THEN
   UPDATE public.pacotes_serrados SET publico_id=token WHERE id=_id AND empresa_id=_empresa;
 ELSE
   UPDATE public.romaneios_madeira_serrada SET publico_id=token WHERE id=_id AND empresa_id=_empresa;
 END IF;
 RETURN token;
END $function$;
REVOKE ALL ON FUNCTION public.publicar_rastreabilidade_serrada(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.publicar_rastreabilidade_serrada(uuid,text,uuid) TO authenticated,service_role;

CREATE FUNCTION public.rastreabilidade_serrada_publica(_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
WITH alvos AS (
 SELECT 'pacote'::text AS tipo,p.id,p.empresa_id,p.numero,p.data FROM public.pacotes_serrados p WHERE _id IS NOT NULL AND p.publico_id=_id
 UNION ALL
 SELECT 'carga'::text,r.id,r.empresa_id,r.numero_carga,r.data FROM public.romaneios_madeira_serrada r WHERE _id IS NOT NULL AND r.publico_id=_id
), alvo AS (SELECT * FROM alvos WHERE (SELECT count(*) FROM alvos)=1), pacotes AS (
 SELECT p.* FROM alvo a JOIN public.pacotes_serrados p ON p.empresa_id=a.empresa_id AND a.tipo='pacote' AND p.id=a.id
 UNION ALL
 SELECT p.* FROM alvo a JOIN public.romaneio_carga_pacotes cp ON a.tipo='carga' AND cp.empresa_id=a.empresa_id AND cp.romaneio_id=a.id
 JOIN public.pacotes_serrados p ON p.id=cp.pacote_id AND p.empresa_id=cp.empresa_id AND p.empresa_id=a.empresa_id
), toras AS (
 SELECT p.id AS pacote_id,p.empresa_id,t.plaqueta,t.arvore,t.secao,t.autex,t.especie,
   coalesce(nullif(trim(t.nome_cientifico),''),ar.nome_cientifico) AS nome_cientifico,
   ar.latitude,ar.longitude,NULL::text AS talhao,ar.abatida_em,
   CASE WHEN t.origem='manejo' THEN coalesce(t.arrastada_em,aa.capturado_em) END AS arrastada_em,
   r.recebido_em AS patio_em
 FROM pacotes p JOIN public.toras t ON t.empresa_id=p.empresa_id AND t.publico_id=ANY(p.toras_origem)
 LEFT JOIN LATERAL (
   SELECT max(w.nome_cientifico) AS nome_cientifico,max(w.latitude) AS latitude,max(w.longitude) AS longitude,max(w.abatida_em) AS abatida_em
   FROM public.arvores w WHERE w.empresa_id=t.empresa_id AND w.autex=t.autex AND w.numero=t.arvore HAVING count(*)=1
 ) ar ON true
 LEFT JOIN LATERAL (
   SELECT g.capturado_em FROM public.arrastos_arvores g WHERE t.origem='manejo' AND g.empresa_id=t.empresa_id AND g.autex=t.autex AND g.arvore=t.arvore AND g.capturado_em IS NOT NULL ORDER BY g.capturado_em DESC LIMIT 1
 ) aa ON true
 LEFT JOIN public.romaneios r ON r.id=t.romaneio_id AND r.empresa_id=t.empresa_id
)
SELECT jsonb_build_object('tipo',a.tipo,'numero',a.numero,'data',a.data,
 'empresa',jsonb_build_object('razao_social',e.nome,'cnpj',CASE WHEN length(regexp_replace(coalesce(e.cnpj,''),'[^0-9]','','g'))=14 THEN e.cnpj END),
 'pacotes',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'numero',p.numero,'data',p.data,'autex',p.autex,'pmfs',p.pmfs,'poa',p.poa,'crv_percentual',p.crv_percentual,
   'itens',coalesce((SELECT jsonb_agg(jsonb_build_object(
     'especie',i.especie,'nome_cientifico',(SELECT CASE WHEN count(DISTINCT nullif(trim(t.nome_cientifico),''))=1 THEN min(nullif(trim(t.nome_cientifico),'')) END FROM toras t WHERE t.pacote_id=p.id AND t.empresa_id=p.empresa_id AND lower(trim(t.especie))=lower(trim(i.especie))),
     'tipo_peca',i.tipo_peca,'grossura',i.grossura,'largura',i.largura,'distribuicao_pecas',i.distribuicao_pecas,'total_pecas',i.total_pecas,'volume_m3',i.volume_m3
   ) ORDER BY i.especie,i.tipo_peca,i.grossura,i.largura,i.id) FROM public.itens_pacote_serrado i WHERE i.pacote_id=p.id AND i.empresa_id=p.empresa_id),'[]'::jsonb),
   'toras',coalesce((SELECT jsonb_agg(jsonb_build_object(
     'plaqueta',t.plaqueta,'arvore',t.arvore,'secao',t.secao,'autex',t.autex,'especie',t.especie,'nome_cientifico',t.nome_cientifico,'latitude',t.latitude,'longitude',t.longitude,'talhao',t.talhao,'abatida_em',t.abatida_em,'arrastada_em',t.arrastada_em,'patio_em',t.patio_em
   ) ORDER BY t.plaqueta) FROM toras t WHERE t.pacote_id=p.id AND t.empresa_id=p.empresa_id),'[]'::jsonb)
 ) ORDER BY p.data,p.numero,p.id) FROM pacotes p WHERE p.empresa_id=a.empresa_id),'[]'::jsonb))
FROM alvo a JOIN public.empresas e ON e.id=a.empresa_id
$function$;
REVOKE ALL ON FUNCTION public.rastreabilidade_serrada_publica(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rastreabilidade_serrada_publica(uuid) TO anon,authenticated,service_role;