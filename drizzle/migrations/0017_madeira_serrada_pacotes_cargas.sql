CREATE TABLE public.pacotes_serrados (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL DEFAULT public.minha_empresa() REFERENCES public.empresas(id), numero text NOT NULL, data date NOT NULL DEFAULT CURRENT_DATE, observacoes text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(empresa_id,numero), UNIQUE(id,empresa_id)
);
GRANT SELECT ON public.pacotes_serrados TO authenticated;
GRANT ALL ON public.pacotes_serrados TO service_role;
ALTER TABLE public.pacotes_serrados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "empresa le pacotes serrados" ON public.pacotes_serrados FOR SELECT TO authenticated USING (empresa_id = public.minha_empresa() OR public.has_role(auth.uid(),'superadmin'));
CREATE TABLE public.itens_pacote_serrado (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL DEFAULT public.minha_empresa(), pacote_id uuid NOT NULL, especie text NOT NULL, tipo_peca text NOT NULL, grossura numeric NOT NULL, largura numeric NOT NULL, distribuicao_pecas jsonb NOT NULL DEFAULT '{}'::jsonb, total_pecas integer NOT NULL DEFAULT 0, volume_m3 numeric(10,4) NOT NULL DEFAULT 0, FOREIGN KEY(pacote_id,empresa_id) REFERENCES public.pacotes_serrados(id,empresa_id) ON DELETE CASCADE
);
GRANT SELECT ON public.itens_pacote_serrado TO authenticated;
GRANT ALL ON public.itens_pacote_serrado TO service_role;
ALTER TABLE public.itens_pacote_serrado ENABLE ROW LEVEL SECURITY;
CREATE POLICY "empresa le itens serrados" ON public.itens_pacote_serrado FOR SELECT TO authenticated USING (empresa_id = public.minha_empresa() OR public.has_role(auth.uid(),'superadmin'));
CREATE TABLE public.romaneios_madeira_serrada (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL DEFAULT public.minha_empresa() REFERENCES public.empresas(id), numero_carga text NOT NULL, data date NOT NULL DEFAULT CURRENT_DATE, cliente_nome text NOT NULL, cliente_documento text NOT NULL DEFAULT '', motorista_nome text NOT NULL, motorista_cpf text NOT NULL DEFAULT '', placa_veiculo text NOT NULL, placa_reboque text NOT NULL DEFAULT '', total_pecas integer NOT NULL DEFAULT 0, total_volume_m3 numeric(10,4) NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(empresa_id,numero_carga), UNIQUE(id,empresa_id)
);
GRANT SELECT ON public.romaneios_madeira_serrada TO authenticated;
GRANT ALL ON public.romaneios_madeira_serrada TO service_role;
ALTER TABLE public.romaneios_madeira_serrada ENABLE ROW LEVEL SECURITY;
CREATE POLICY "empresa le cargas serradas" ON public.romaneios_madeira_serrada FOR SELECT TO authenticated USING (empresa_id = public.minha_empresa() OR public.has_role(auth.uid(),'superadmin'));
CREATE TABLE public.romaneio_carga_pacotes (
 empresa_id uuid NOT NULL DEFAULT public.minha_empresa(), romaneio_id uuid NOT NULL, pacote_id uuid NOT NULL UNIQUE, PRIMARY KEY(romaneio_id,pacote_id), FOREIGN KEY(romaneio_id,empresa_id) REFERENCES public.romaneios_madeira_serrada(id,empresa_id), FOREIGN KEY(pacote_id,empresa_id) REFERENCES public.pacotes_serrados(id,empresa_id)
);
GRANT SELECT ON public.romaneio_carga_pacotes TO authenticated;
GRANT ALL ON public.romaneio_carga_pacotes TO service_role;
ALTER TABLE public.romaneio_carga_pacotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "empresa le vinculos serrados" ON public.romaneio_carga_pacotes FOR SELECT TO authenticated USING (empresa_id = public.minha_empresa() OR public.has_role(auth.uid(),'superadmin'));
CREATE INDEX itens_serrados_pacote ON public.itens_pacote_serrado(pacote_id);
CREATE INDEX cargas_serradas_empresa ON public.romaneios_madeira_serrada(empresa_id,created_at);
CREATE OR REPLACE FUNCTION public.validar_item_serrado() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE k text; v jsonb; comp numeric; n numeric; total numeric := 0; vol numeric := 0;
BEGIN
 IF NEW.grossura <= 0 OR NEW.largura <= 0 OR trim(NEW.especie) = '' OR trim(NEW.tipo_peca) = '' THEN RAISE EXCEPTION 'Informe espécie, tipo e bitola positiva'; END IF;
 IF jsonb_typeof(NEW.distribuicao_pecas) <> 'object' THEN RAISE EXCEPTION 'Grade de peças inválida'; END IF;
 FOR k,v IN SELECT * FROM jsonb_each(NEW.distribuicao_pecas) LOOP
  IF k !~ '^[1-9]\.[05]$' OR k = '9.5' OR jsonb_typeof(v) <> 'number' THEN RAISE EXCEPTION 'Comprimento ou quantidade inválidos'; END IF;
  comp := k::numeric; n := v::text::numeric;
  IF n < 0 OR n <> trunc(n) THEN RAISE EXCEPTION 'Peças devem ser inteiras e não negativas'; END IF;
  total := total + n; vol := vol + NEW.grossura * NEW.largura * comp * n / 10000;
 END LOOP;
 IF total < 1 THEN RAISE EXCEPTION 'Adicione peças em cada bitola'; END IF;
 NEW.total_pecas := total; NEW.volume_m3 := round(vol,4); RETURN NEW;
END $$;
CREATE TRIGGER validar_item_serrado BEFORE INSERT OR UPDATE ON public.itens_pacote_serrado FOR EACH ROW EXECUTE FUNCTION public.validar_item_serrado();
CREATE OR REPLACE FUNCTION public.salvar_pacote_serrado(_empresa uuid, _id uuid, _cab jsonb, _itens jsonb, _log jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE item jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT (_empresa = public.minha_empresa() OR public.has_role(auth.uid(),'superadmin')) THEN RAISE EXCEPTION 'Empresa não autorizada'; END IF;
 IF trim(coalesce(_cab->>'numero','')) = '' OR jsonb_typeof(_itens) <> 'array' OR jsonb_array_length(_itens) = 0 THEN RAISE EXCEPTION 'Informe número e bitolas do pacote'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_id::text,0));
 PERFORM 1 FROM public.pacotes_serrados WHERE id = _id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.pacotes_serrados WHERE id = _id AND empresa_id <> _empresa) THEN RAISE EXCEPTION 'Pacote de outra empresa'; END IF;
 IF EXISTS(SELECT 1 FROM public.romaneio_carga_pacotes WHERE pacote_id = _id) THEN RAISE EXCEPTION 'Pacote já expedido não pode ser alterado'; END IF;
 INSERT INTO public.pacotes_serrados(id,empresa_id,numero,data,observacoes) VALUES(_id,_empresa,trim(_cab->>'numero'),(_cab->>'data')::date,coalesce(_cab->>'observacoes','')) ON CONFLICT(id) DO UPDATE SET numero = EXCLUDED.numero, data = EXCLUDED.data, observacoes = EXCLUDED.observacoes;
 DELETE FROM public.itens_pacote_serrado WHERE pacote_id = _id AND empresa_id = _empresa;
 FOR item IN SELECT * FROM jsonb_array_elements(_itens) LOOP
 INSERT INTO public.itens_pacote_serrado(empresa_id,pacote_id,especie,tipo_peca,grossura,largura,distribuicao_pecas) VALUES(_empresa,_id,trim(item->>'especie'),trim(item->>'tipo_peca'),(item->>'grossura')::numeric,(item->>'largura')::numeric,item->'distribuicao_pecas');
 END LOOP;
 INSERT INTO public.registros(empresa_id,user_id,user_email,acao,detalhe,lat,lng,criado_em) VALUES(_empresa,auth.uid(),auth.jwt()->>'email','Pacote de madeira serrada salvo','Pacote '||(_cab->>'numero'),nullif(_log->>'lat','')::double precision,nullif(_log->>'lng','')::double precision,coalesce((_log->>'criado_em')::timestamptz,now()));
 RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.salvar_pacote_serrado(uuid,uuid,jsonb,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.salvar_pacote_serrado(uuid,uuid,jsonb,jsonb,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.excluir_pacote_serrado(_empresa uuid, _id uuid, _log jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE num text;
BEGIN
 IF auth.uid() IS NULL OR NOT (_empresa = public.minha_empresa() OR public.has_role(auth.uid(),'superadmin')) THEN RAISE EXCEPTION 'Empresa não autorizada'; END IF;
 SELECT numero INTO num FROM public.pacotes_serrados WHERE id = _id AND empresa_id = _empresa FOR UPDATE;
 IF num IS NULL THEN RAISE EXCEPTION 'Pacote não encontrado'; END IF;
 IF EXISTS(SELECT 1 FROM public.romaneio_carga_pacotes WHERE pacote_id = _id) THEN RAISE EXCEPTION 'Pacote já expedido não pode ser excluído'; END IF;
 DELETE FROM public.pacotes_serrados WHERE id = _id AND empresa_id = _empresa;
 INSERT INTO public.registros(empresa_id,user_id,user_email,acao,detalhe,lat,lng,criado_em) VALUES(_empresa,auth.uid(),auth.jwt()->>'email','Pacote de madeira serrada excluído','Pacote '||num,nullif(_log->>'lat','')::double precision,nullif(_log->>'lng','')::double precision,coalesce((_log->>'criado_em')::timestamptz,now()));
END $$;
REVOKE ALL ON FUNCTION public.excluir_pacote_serrado(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.excluir_pacote_serrado(uuid,uuid,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.salvar_carga_serrada(_empresa uuid, _id uuid, _cab jsonb, _pacotes uuid[], _log jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE qtd integer; pecas integer; vol numeric;
BEGIN
 IF auth.uid() IS NULL OR NOT (_empresa = public.minha_empresa() OR public.has_role(auth.uid(),'superadmin')) THEN RAISE EXCEPTION 'Empresa não autorizada'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_id::text,0));
 IF EXISTS(SELECT 1 FROM public.romaneios_madeira_serrada WHERE id = _id AND empresa_id = _empresa) THEN RETURN _id; END IF;
 IF cardinality(_pacotes) IS NULL OR cardinality(_pacotes) = 0 OR trim(coalesce(_cab->>'numero_carga','')) = '' OR trim(coalesce(_cab->>'cliente_nome','')) = '' OR trim(coalesce(_cab->>'motorista_nome','')) = '' OR trim(coalesce(_cab->>'placa_veiculo','')) = '' THEN RAISE EXCEPTION 'Preencha a identificação da carga e selecione pacotes'; END IF;
 PERFORM 1 FROM public.pacotes_serrados WHERE id = ANY(_pacotes) AND empresa_id = _empresa ORDER BY id FOR UPDATE;
 SELECT count(*) INTO qtd FROM public.pacotes_serrados WHERE id = ANY(_pacotes) AND empresa_id = _empresa;
 IF qtd <> cardinality(_pacotes) THEN RAISE EXCEPTION 'Pacotes inválidos ou de outra empresa'; END IF;
 IF EXISTS(SELECT 1 FROM public.romaneio_carga_pacotes WHERE pacote_id = ANY(_pacotes)) THEN RAISE EXCEPTION 'Um pacote já foi incluído em outra carga. Atualize a lista'; END IF;
 SELECT sum(total_pecas),sum(volume_m3) INTO pecas,vol FROM public.itens_pacote_serrado WHERE pacote_id = ANY(_pacotes) AND empresa_id = _empresa;
 IF coalesce(pecas,0) < 1 THEN RAISE EXCEPTION 'Pacotes sem peças'; END IF;
 INSERT INTO public.romaneios_madeira_serrada(id,empresa_id,numero_carga,data,cliente_nome,cliente_documento,motorista_nome,motorista_cpf,placa_veiculo,placa_reboque,total_pecas,total_volume_m3) VALUES(_id,_empresa,trim(_cab->>'numero_carga'),(_cab->>'data')::date,trim(_cab->>'cliente_nome'),coalesce(_cab->>'cliente_documento',''),trim(_cab->>'motorista_nome'),coalesce(_cab->>'motorista_cpf',''),upper(trim(_cab->>'placa_veiculo')),upper(trim(coalesce(_cab->>'placa_reboque',''))),pecas,vol);
 INSERT INTO public.romaneio_carga_pacotes(empresa_id,romaneio_id,pacote_id) SELECT _empresa,_id,unnest(_pacotes);
 INSERT INTO public.registros(empresa_id,user_id,user_email,acao,detalhe,lat,lng,criado_em) VALUES(_empresa,auth.uid(),auth.jwt()->>'email','Carga de madeira serrada expedida',(_cab->>'numero_carga')||' · '||qtd||' pacotes · '||pecas||' peças',nullif(_log->>'lat','')::double precision,nullif(_log->>'lng','')::double precision,coalesce((_log->>'criado_em')::timestamptz,now()));
 RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.salvar_carga_serrada(uuid,uuid,jsonb,uuid[],jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.salvar_carga_serrada(uuid,uuid,jsonb,uuid[],jsonb) TO authenticated;