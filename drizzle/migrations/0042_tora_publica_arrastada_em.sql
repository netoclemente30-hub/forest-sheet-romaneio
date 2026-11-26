DROP FUNCTION public.tora_publica(uuid);
CREATE FUNCTION public.tora_publica(_id uuid)
 RETURNS TABLE(plaqueta integer, arvore integer, secao text, especie text, nome_cientifico text, autex text, d_topo1 numeric, d_topo2 numeric, d_pe1 numeric, d_pe2 numeric, comprimento numeric, volume numeric, carregada boolean, serrada_em timestamp with time zone, created_at timestamp with time zone, origem text, romaneio_data date, empresa_nome text, fazenda text, abatida_em timestamp with time zone, latitude double precision, longitude double precision, placa text, destino text, arrastada_em timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT t.plaqueta::integer, t.arvore::integer, t.secao, t.especie, t.nome_cientifico, t.autex,
    t.d_topo1::numeric, t.d_topo2::numeric, t.d_pe1::numeric, t.d_pe2::numeric, t.comprimento::numeric, t.volume::numeric,
    t.carregada, t.serrada_em, t.created_at, t.origem, r.data::date, e.nome,
    a.descricao, ar.abatida_em, ar.latitude::double precision, ar.longitude::double precision, r.placa, r.patio,
    CASE WHEN t.origem = 'manejo' THEN COALESCE(t.arrastada_em, aa.capturado_em) END
  FROM public.toras t
  JOIN public.empresas e ON e.id = t.empresa_id
  LEFT JOIN public.romaneios r ON r.id = t.romaneio_id AND r.empresa_id = t.empresa_id
  LEFT JOIN LATERAL (SELECT x.descricao FROM public.autex x WHERE x.empresa_id = t.empresa_id AND x.numero = t.autex LIMIT 1) a ON true
  LEFT JOIN LATERAL (SELECT w.abatida_em, w.latitude, w.longitude FROM public.arvores w WHERE w.empresa_id = t.empresa_id AND w.autex = t.autex AND w.numero::text = t.arvore::text LIMIT 1) ar ON true
  LEFT JOIN LATERAL (SELECT g.capturado_em FROM public.arrastos_arvores g
    WHERE t.origem = 'manejo' AND g.empresa_id = t.empresa_id AND g.autex = t.autex AND g.arvore = t.arvore
      AND g.capturado_em IS NOT NULL
    ORDER BY g.capturado_em DESC LIMIT 1) aa ON true
  WHERE t.publico_id = _id
  LIMIT 1
$function$;
REVOKE ALL ON FUNCTION public.tora_publica(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tora_publica(uuid) TO anon, authenticated, service_role;