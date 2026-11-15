-- Importação atômica da ficha de campo: tudo é confirmado ou nada é gravado.
-- Evita que lote 500/1000 deixe o estoque parcialmente importado após erro.
CREATE OR REPLACE FUNCTION public.importar_ficha_manejo(
 _empresa uuid, _arvores jsonb, _toras jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE qtd_arvores integer; qtd_toras integer;
BEGIN
 IF auth.uid() IS NULL OR _empresa IS NULL OR NOT (
   public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin')
 ) OR NOT (_empresa = public.minha_empresa() OR public.has_role(auth.uid(),'superadmin'))
 THEN RAISE EXCEPTION 'Apenas administradores da empresa podem importar fichas'; END IF;
 IF jsonb_typeof(_arvores) <> 'array' OR jsonb_typeof(_toras) <> 'array'
 THEN RAISE EXCEPTION 'Arquivo de importação inválido'; END IF;
 qtd_arvores := jsonb_array_length(_arvores);
 qtd_toras := jsonb_array_length(_toras);
 IF qtd_arvores < 1 THEN RAISE EXCEPTION 'Nenhuma árvore para importar'; END IF;
 IF qtd_arvores > 10000 OR qtd_toras > 10000
 THEN RAISE EXCEPTION 'Arquivo muito grande. Divida a ficha em arquivos menores de até 10000 itens'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_empresa::text,0));
 -- A base de AUTEX também é criada na mesma transação.
 INSERT INTO public.autex(empresa_id, numero)
 SELECT DISTINCT _empresa, a.autex
 FROM jsonb_to_recordset(_arvores) AS a(autex text)
 WHERE NULLIF(trim(a.autex),'') IS NOT NULL
 ON CONFLICT(empresa_id,numero) DO NOTHING;

 -- Atualiza inventário e preserva coordenadas previamente registradas quando
 -- o arquivo não possui novas coordenadas para a mesma árvore.
 INSERT INTO public.arvores (
   empresa_id,numero,autex,nome_vulgar,nome_cientifico,
   cap,dap,altura,volume,categoria,picada,latitude,longitude,localizado_em
 )
 SELECT _empresa,a.numero,a.autex,a.nome_vulgar,a.nome_cientifico,
   a.cap,a.dap,a.altura,a.volume,a.categoria,a.picada,
   a.latitude,a.longitude,
   CASE WHEN a.latitude IS NOT NULL AND a.longitude IS NOT NULL THEN now() ELSE NULL END
 FROM jsonb_to_recordset(_arvores) AS a(
   numero integer,autex text,nome_vulgar text,nome_cientifico text,
   cap numeric,dap numeric,altura numeric,volume numeric,categoria text,picada text,
   latitude double precision,longitude double precision
 )
 WHERE a.numero IS NOT NULL AND NULLIF(trim(a.autex),'') IS NOT NULL
 ON CONFLICT(empresa_id,numero,autex) DO UPDATE SET
   nome_vulgar=EXCLUDED.nome_vulgar,nome_cientifico=EXCLUDED.nome_cientifico,
   cap=EXCLUDED.cap,dap=EXCLUDED.dap,altura=EXCLUDED.altura,
   volume=EXCLUDED.volume,categoria=EXCLUDED.categoria,picada=EXCLUDED.picada,
   latitude=coalesce(EXCLUDED.latitude,public.arvores.latitude),
   longitude=coalesce(EXCLUDED.longitude,public.arvores.longitude),
   localizado_em=coalesce(EXCLUDED.localizado_em,public.arvores.localizado_em);

 -- Não sobrescrever medições/cargas existentes no estoque.
 INSERT INTO public.toras (
   empresa_id,plaqueta,arvore,secao,especie,nome_cientifico,autex,
   d_topo1,d_topo2,d_pe1,d_pe2,comprimento,volume,origem,carregada
 )
 SELECT _empresa,t.plaqueta,t.arvore,t.secao,t.especie,t.nome_cientifico,t.autex,
   t.d_topo1,t.d_topo2,t.d_pe1,t.d_pe2,t.comprimento,coalesce(t.volume,0),
   'manejo',coalesce(t.carregada,false)
 FROM jsonb_to_recordset(_toras) AS t(
   plaqueta integer, arvore integer, secao text, especie text,
   nome_cientifico text,autex text, d_topo1 numeric,d_topo2 numeric,
   d_pe1 numeric,d_pe2 numeric,comprimento numeric,volume numeric,
   origem text,carregada boolean
 )
 WHERE t.plaqueta IS NOT NULL AND t.arvore IS NOT NULL
 ON CONFLICT (empresa_id,plaqueta) DO NOTHING;
 RETURN jsonb_build_object('arvores',qtd_arvores,'toras',qtd_toras);
END $$;
REVOKE ALL ON FUNCTION public.importar_ficha_manejo(uuid,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.importar_ficha_manejo(uuid,jsonb,jsonb) TO authenticated;
