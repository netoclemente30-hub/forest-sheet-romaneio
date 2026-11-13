ALTER TABLE public.toras ADD COLUMN IF NOT EXISTS publico_id uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS toras_publico_id_key ON public.toras(publico_id);

CREATE OR REPLACE FUNCTION public.tora_publica(_id uuid)
RETURNS TABLE (
  plaqueta integer, arvore integer, secao text, especie text, nome_cientifico text, autex text,
  d_topo1 numeric, d_topo2 numeric, d_pe1 numeric, d_pe2 numeric, comprimento numeric, volume numeric,
  carregada boolean, serrada_em timestamptz, created_at timestamptz, origem text,
  romaneio_data date, empresa_nome text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.plaqueta::integer, t.arvore::integer, t.secao, t.especie, t.nome_cientifico, t.autex,
    t.d_topo1::numeric, t.d_topo2::numeric, t.d_pe1::numeric, t.d_pe2::numeric, t.comprimento::numeric, t.volume::numeric,
    t.carregada, t.serrada_em, t.created_at, t.origem,
    r.data::date, e.nome
  FROM public.toras t
  JOIN public.empresas e ON e.id = t.empresa_id
  LEFT JOIN public.romaneios r ON r.id = t.romaneio_id
  WHERE t.publico_id = _id
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.tora_publica(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tora_publica(uuid) TO anon, authenticated, service_role;