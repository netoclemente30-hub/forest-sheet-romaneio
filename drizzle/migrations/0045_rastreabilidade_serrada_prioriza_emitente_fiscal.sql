CREATE OR REPLACE FUNCTION public.rastreabilidade_serrada_publica(_id uuid)
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
 'empresa',jsonb_build_object(
   'razao_social',CASE WHEN nullif(trim(coalesce(ee.cadastro->>'nome','')),'') IS NOT NULL AND length(regexp_replace(coalesce(ee.cadastro->>'cnpj',''),'[^0-9]','','g'))=14 THEN ee.cadastro->>'nome' ELSE e.nome END,
   'cnpj',CASE WHEN nullif(trim(coalesce(ee.cadastro->>'nome','')),'') IS NOT NULL AND length(regexp_replace(coalesce(ee.cadastro->>'cnpj',''),'[^0-9]','','g'))=14 THEN ee.cadastro->>'cnpj' WHEN length(regexp_replace(coalesce(e.cnpj,''),'[^0-9]','','g'))=14 THEN e.cnpj END
 ),
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
LEFT JOIN public.empresa_emitente ee ON ee.empresa_id=a.empresa_id
$function$;
REVOKE ALL ON FUNCTION public.rastreabilidade_serrada_publica(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rastreabilidade_serrada_publica(uuid) TO anon,authenticated,service_role;