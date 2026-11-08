ALTER TABLE public.pacotes_serrados ADD COLUMN autex text NOT NULL DEFAULT '';
COMMENT ON COLUMN public.pacotes_serrados.autex IS 'AUTEX selecionada do cadastro ou digitada livremente, independente do estoque de toras';
DO $$
DECLARE definicao text;
BEGIN
 definicao := pg_get_functiondef('public.salvar_pacote_serrado(uuid,uuid,jsonb,jsonb,jsonb)'::regprocedure);
 definicao := replace(definicao,'INSERT INTO public.pacotes_serrados(id,empresa_id,numero,data,observacoes) VALUES(_id,_empresa,trim(_cab->>''numero''),(_cab->>''data'')::date,coalesce(_cab->>''observacoes'','''')) ON CONFLICT(id) DO UPDATE SET numero = EXCLUDED.numero, data = EXCLUDED.data, observacoes = EXCLUDED.observacoes;', 'INSERT INTO public.pacotes_serrados(id,empresa_id,numero,data,observacoes,autex) VALUES(_id,_empresa,trim(_cab->>''numero''),(_cab->>''data'')::date,coalesce(_cab->>''observacoes'',''''),trim(coalesce(_cab->>''autex'',''''))) ON CONFLICT(id) DO UPDATE SET numero = EXCLUDED.numero, data = EXCLUDED.data, observacoes = EXCLUDED.observacoes, autex = EXCLUDED.autex;');
 IF position('autex = EXCLUDED.autex' in definicao) = 0 THEN RAISE EXCEPTION 'Atualização AUTEX não aplicada'; END IF;
 EXECUTE definicao;
END $$;