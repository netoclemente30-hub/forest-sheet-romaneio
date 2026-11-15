DO $$
DECLARE tabela text; politica record;
BEGIN
  FOREACH tabela IN ARRAY ARRAY['arvores','autex','mapas_exploracao','rastros_gps','toras','romaneios','patios','veiculos','motoristas','toras_aguardando','saldos','pacotes_serrados','itens_pacote_serrado','romaneios_madeira_serrada','romaneio_carga_pacotes','registros'] LOOP
    FOR politica IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=tabela LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', politica.policyname, tabela);
    END LOOP;
  END LOOP;
END $$;

CREATE POLICY "funcao_arvores_ler" ON public.arvores FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'mapa_ver') OR public.pode_funcao(empresa_id,'toras_lancar') OR public.pode_funcao(empresa_id,'informacoes_ver'));
CREATE POLICY "funcao_arvores_criar" ON public.arvores FOR INSERT TO authenticated WITH CHECK (public.pode_funcao(empresa_id,'usuarios_gerenciar'));
CREATE POLICY "funcao_arvores_editar" ON public.arvores FOR UPDATE TO authenticated USING (public.pode_funcao(empresa_id,'mapa_abater')) WITH CHECK (public.pode_funcao(empresa_id,'mapa_abater'));
CREATE POLICY "funcao_arvores_excluir" ON public.arvores FOR DELETE TO authenticated USING (public.pode_funcao(empresa_id,'usuarios_gerenciar'));

CREATE POLICY "funcao_autex_ler" ON public.autex FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'mapa_ver') OR public.pode_funcao(empresa_id,'toras_ver') OR public.pode_funcao(empresa_id,'carga_criar') OR public.pode_funcao(empresa_id,'serraria_ver') OR public.pode_funcao(empresa_id,'informacoes_ver'));
CREATE POLICY "funcao_autex_criar" ON public.autex FOR INSERT TO authenticated WITH CHECK (public.pode_funcao(empresa_id,'base_importar') OR public.pode_funcao(empresa_id,'serraria_operar'));
CREATE POLICY "funcao_autex_editar" ON public.autex FOR UPDATE TO authenticated USING (public.pode_funcao(empresa_id,'base_importar')) WITH CHECK (public.pode_funcao(empresa_id,'base_importar'));
CREATE POLICY "funcao_autex_excluir" ON public.autex FOR DELETE TO authenticated USING (public.pode_funcao(empresa_id,'base_importar'));

CREATE POLICY "funcao_mapas_ler" ON public.mapas_exploracao FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'mapa_ver') OR public.pode_funcao(empresa_id,'informacoes_ver'));
CREATE POLICY "funcao_mapas_criar" ON public.mapas_exploracao FOR INSERT TO authenticated WITH CHECK (public.pode_funcao(empresa_id,'base_importar'));
CREATE POLICY "funcao_mapas_editar" ON public.mapas_exploracao FOR UPDATE TO authenticated USING (public.pode_funcao(empresa_id,'base_importar')) WITH CHECK (public.pode_funcao(empresa_id,'base_importar'));
CREATE POLICY "funcao_mapas_excluir" ON public.mapas_exploracao FOR DELETE TO authenticated USING (public.pode_funcao(empresa_id,'base_importar'));

CREATE POLICY "funcao_rastros_ler" ON public.rastros_gps FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'mapa_ver') OR public.pode_funcao(empresa_id,'informacoes_ver'));
CREATE POLICY "funcao_rastros_criar" ON public.rastros_gps FOR INSERT TO authenticated WITH CHECK (public.pode_funcao(empresa_id,'mapa_rastrear'));

CREATE POLICY "funcao_toras_ler" ON public.toras FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'toras_ver') OR public.pode_funcao(empresa_id,'informacoes_ver'));
CREATE POLICY "funcao_toras_criar" ON public.toras FOR INSERT TO authenticated WITH CHECK (public.pode_funcao(empresa_id,'usuarios_gerenciar') OR (public.pode_funcao(empresa_id,'serraria_operar') AND origem='serraria' AND NOT carregada AND romaneio_id IS NULL AND serrada_em IS NULL));
CREATE POLICY "funcao_toras_etiqueta" ON public.toras FOR UPDATE TO authenticated USING (public.pode_funcao(empresa_id,'toras_lancar') OR public.pode_funcao(empresa_id,'serraria_operar')) WITH CHECK (public.pode_funcao(empresa_id,'toras_lancar') OR public.pode_funcao(empresa_id,'serraria_operar'));
CREATE POLICY "funcao_toras_excluir" ON public.toras FOR DELETE TO authenticated USING (public.pode_funcao(empresa_id,'usuarios_gerenciar'));
REVOKE UPDATE ON public.toras FROM PUBLIC, anon, authenticated;
GRANT UPDATE(etiqueta_impressa_em) ON public.toras TO authenticated;

CREATE POLICY "funcao_romaneios_ler" ON public.romaneios FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'carga_consultar') OR public.pode_funcao(empresa_id,'serraria_ver') OR public.pode_funcao(empresa_id,'informacoes_ver'));
CREATE POLICY "funcao_romaneios_admin_criar" ON public.romaneios FOR INSERT TO authenticated WITH CHECK (public.pode_funcao(empresa_id,'usuarios_gerenciar'));
CREATE POLICY "funcao_romaneios_admin_editar" ON public.romaneios FOR UPDATE TO authenticated USING (public.pode_funcao(empresa_id,'usuarios_gerenciar')) WITH CHECK (public.pode_funcao(empresa_id,'usuarios_gerenciar'));
CREATE POLICY "funcao_romaneios_admin_excluir" ON public.romaneios FOR DELETE TO authenticated USING (public.pode_funcao(empresa_id,'usuarios_gerenciar'));

CREATE POLICY "funcao_patios_ler" ON public.patios FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'serraria_ver') OR public.pode_funcao(empresa_id,'informacoes_ver'));
CREATE POLICY "funcao_patios_criar" ON public.patios FOR INSERT TO authenticated WITH CHECK (public.pode_funcao(empresa_id,'serraria_operar'));
CREATE POLICY "funcao_patios_editar" ON public.patios FOR UPDATE TO authenticated USING (public.pode_funcao(empresa_id,'usuarios_gerenciar')) WITH CHECK (public.pode_funcao(empresa_id,'usuarios_gerenciar'));
CREATE POLICY "funcao_patios_excluir" ON public.patios FOR DELETE TO authenticated USING (public.pode_funcao(empresa_id,'usuarios_gerenciar'));

CREATE POLICY "funcao_veiculos_ler" ON public.veiculos FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'carga_consultar') OR public.pode_funcao(empresa_id,'serraria_ver') OR public.pode_funcao(empresa_id,'informacoes_ver'));
CREATE POLICY "funcao_veiculos_criar" ON public.veiculos FOR INSERT TO authenticated WITH CHECK (public.pode_funcao(empresa_id,'carga_criar'));
CREATE POLICY "funcao_veiculos_editar" ON public.veiculos FOR UPDATE TO authenticated USING (public.pode_funcao(empresa_id,'usuarios_gerenciar')) WITH CHECK (public.pode_funcao(empresa_id,'usuarios_gerenciar'));
CREATE POLICY "funcao_veiculos_excluir" ON public.veiculos FOR DELETE TO authenticated USING (public.pode_funcao(empresa_id,'usuarios_gerenciar'));

CREATE POLICY "funcao_motoristas_ler" ON public.motoristas FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'carga_criar') OR public.pode_funcao(empresa_id,'informacoes_ver'));
CREATE POLICY "funcao_motoristas_criar" ON public.motoristas FOR INSERT TO authenticated WITH CHECK (public.pode_funcao(empresa_id,'carga_criar'));
CREATE POLICY "funcao_motoristas_editar" ON public.motoristas FOR UPDATE TO authenticated USING (public.pode_funcao(empresa_id,'usuarios_gerenciar')) WITH CHECK (public.pode_funcao(empresa_id,'usuarios_gerenciar'));
CREATE POLICY "funcao_motoristas_excluir" ON public.motoristas FOR DELETE TO authenticated USING (public.pode_funcao(empresa_id,'usuarios_gerenciar'));

CREATE POLICY "funcao_aguardando_ler" ON public.toras_aguardando FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'serraria_ver') OR public.pode_funcao(empresa_id,'informacoes_ver'));
CREATE POLICY "funcao_aguardando_criar" ON public.toras_aguardando FOR INSERT TO authenticated WITH CHECK (public.pode_funcao(empresa_id,'serraria_operar'));
CREATE POLICY "funcao_aguardando_editar" ON public.toras_aguardando FOR UPDATE TO authenticated USING (public.pode_funcao(empresa_id,'serraria_operar')) WITH CHECK (public.pode_funcao(empresa_id,'serraria_operar'));
CREATE POLICY "funcao_aguardando_excluir" ON public.toras_aguardando FOR DELETE TO authenticated USING (public.pode_funcao(empresa_id,'serraria_operar'));

CREATE POLICY "funcao_saldos_ler" ON public.saldos FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'serraria_ver') OR public.pode_funcao(empresa_id,'informacoes_ver'));
CREATE POLICY "funcao_saldos_criar" ON public.saldos FOR INSERT TO authenticated WITH CHECK (public.pode_funcao(empresa_id,'serraria_operar'));
CREATE POLICY "funcao_saldos_editar" ON public.saldos FOR UPDATE TO authenticated USING (public.pode_funcao(empresa_id,'serraria_operar')) WITH CHECK (public.pode_funcao(empresa_id,'serraria_operar'));
CREATE POLICY "funcao_saldos_excluir" ON public.saldos FOR DELETE TO authenticated USING (public.pode_funcao(empresa_id,'serraria_operar'));

CREATE POLICY "funcao_pacotes_ler" ON public.pacotes_serrados FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'serraria_ver') OR public.pode_funcao(empresa_id,'informacoes_ver'));
CREATE POLICY "funcao_itens_ler" ON public.itens_pacote_serrado FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'serraria_ver') OR public.pode_funcao(empresa_id,'informacoes_ver'));
CREATE POLICY "funcao_cargas_serradas_ler" ON public.romaneios_madeira_serrada FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'serraria_ver') OR public.pode_funcao(empresa_id,'informacoes_ver'));
CREATE POLICY "funcao_carga_pacotes_ler" ON public.romaneio_carga_pacotes FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'serraria_ver') OR public.pode_funcao(empresa_id,'informacoes_ver'));
REVOKE INSERT, UPDATE, DELETE ON public.pacotes_serrados, public.itens_pacote_serrado, public.romaneios_madeira_serrada, public.romaneio_carga_pacotes FROM PUBLIC, anon, authenticated;

CREATE POLICY "funcao_registros_ler" ON public.registros FOR SELECT TO authenticated
USING (public.pode_funcao(empresa_id,'registros_ver') OR (acao='Encaixe confirmado' AND public.pode_funcao(empresa_id,'serraria_ver')));
REVOKE INSERT, UPDATE, DELETE ON public.registros FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.registros TO authenticated;

-- Cortador só altera localização/abate da árvore
CREATE OR REPLACE FUNCTION public.restringir_edicao_arvore_por_cargo()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF public.pode_funcao(NEW.empresa_id,'usuarios_gerenciar') THEN RETURN NEW; END IF;
  IF NOT public.pode_funcao(NEW.empresa_id,'mapa_abater') THEN RAISE EXCEPTION 'Seu cargo não pode editar árvores'; END IF;
  IF (to_jsonb(NEW) - ARRAY['latitude','longitude','gps_precisao','localizado_em','abatida_em','nao_abatida_motivo','nao_abatida_em'])
     IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['latitude','longitude','gps_precisao','localizado_em','abatida_em','nao_abatida_motivo','nao_abatida_em'])
  THEN RAISE EXCEPTION 'Cortador não pode alterar cadastro, AUTEX ou medidas da árvore'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS restringir_edicao_arvore_cargo ON public.arvores;
CREATE TRIGGER restringir_edicao_arvore_cargo BEFORE UPDATE ON public.arvores FOR EACH ROW EXECUTE FUNCTION public.restringir_edicao_arvore_por_cargo();

-- PDF do mapa no armazenamento
DROP POLICY IF EXISTS "cargos mapas leitura" ON storage.objects;
DROP POLICY IF EXISTS "cargos mapas envio" ON storage.objects;
DROP POLICY IF EXISTS "cargos mapas alteração" ON storage.objects;
DROP POLICY IF EXISTS "cargos mapas exclusão" ON storage.objects;
CREATE POLICY "cargos mapas leitura" ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING (bucket_id <> 'mapas-exploracao' OR EXISTS (SELECT 1 FROM public.empresas e WHERE e.id::text=(storage.foldername(name))[1] AND (public.pode_funcao(e.id,'mapa_ver') OR public.pode_funcao(e.id,'informacoes_ver'))));
CREATE POLICY "cargos mapas envio" ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (bucket_id <> 'mapas-exploracao' OR EXISTS (SELECT 1 FROM public.empresas e WHERE e.id::text=(storage.foldername(name))[1] AND public.pode_funcao(e.id,'base_importar')));
CREATE POLICY "cargos mapas alteração" ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING (bucket_id <> 'mapas-exploracao' OR EXISTS (SELECT 1 FROM public.empresas e WHERE e.id::text=(storage.foldername(name))[1] AND public.pode_funcao(e.id,'base_importar'))) WITH CHECK (bucket_id <> 'mapas-exploracao' OR EXISTS (SELECT 1 FROM public.empresas e WHERE e.id::text=(storage.foldername(name))[1] AND public.pode_funcao(e.id,'base_importar')));
CREATE POLICY "cargos mapas exclusão" ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING (bucket_id <> 'mapas-exploracao' OR EXISTS (SELECT 1 FROM public.empresas e WHERE e.id::text=(storage.foldername(name))[1] AND public.pode_funcao(e.id,'base_importar')));

-- Evento avulso de auditoria
CREATE OR REPLACE FUNCTION public.registrar_evento(_empresa uuid, _log jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE emp uuid; rid uuid; op uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  emp := COALESCE(_empresa, public.minha_empresa());
  IF emp IS NULL AND NOT public.has_role(auth.uid(),'superadmin') THEN RAISE EXCEPTION 'Empresa não encontrada'; END IF;
  IF emp IS NOT NULL AND NOT (emp = public.minha_empresa() OR public.has_role(auth.uid(),'superadmin')) THEN RAISE EXCEPTION 'Empresa não autorizada'; END IF;
  IF COALESCE(_log->>'acao','') <> 'Login' AND NOT (
    public.pode_funcao(emp,'usuarios_gerenciar') OR public.pode_funcao(emp,'mapa_abater') OR public.pode_funcao(emp,'mapa_arrastar')
    OR public.pode_funcao(emp,'toras_lancar') OR public.pode_funcao(emp,'carga_criar') OR public.pode_funcao(emp,'serraria_operar')
  ) THEN RAISE EXCEPTION 'Cargo somente consulta não pode registrar alterações'; END IF;
  op := NULLIF(_log->>'operacao_id','')::uuid;
  IF op IS NOT NULL THEN
    SELECT id INTO rid FROM public.registros WHERE operacao_id = op AND empresa_id IS NOT DISTINCT FROM emp;
    IF rid IS NOT NULL THEN RETURN rid; END IF;
  END IF;
  INSERT INTO public.registros (empresa_id,user_id,user_email,acao,detalhe,lat,lng,criado_em,operacao_id,aparelho_nome,aparelho_modelo,aparelho_ua)
  VALUES (emp,auth.uid(),auth.jwt()->>'email',LEFT(COALESCE(NULLIF(_log->>'acao',''),'Evento registrado'),160),LEFT(COALESCE(_log->>'detalhe',''),1200),
    NULLIF(_log->>'lat','')::double precision,NULLIF(_log->>'lng','')::double precision,COALESCE(NULLIF(_log->>'criado_em','')::timestamptz,now()),op,
    LEFT(_log->>'aparelho_nome',120),LEFT(_log->>'aparelho_modelo',120),LEFT(_log->>'aparelho_ua',500))
  RETURNING id INTO rid;
  RETURN rid;
END $$;
REVOKE ALL ON FUNCTION public.registrar_evento(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_evento(uuid,jsonb) TO authenticated;

-- Carga de toras (motorista/admin), idempotente por operação
CREATE OR REPLACE FUNCTION public.salvar_romaneio_toras(_empresa uuid, _cab jsonb, _plaquetas integer[], _operacao uuid, _log jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE rid uuid; id_rom uuid; qtd integer; vol numeric; encontradas integer; invalidas integer;
BEGIN
  IF auth.uid() IS NULL OR _empresa IS NULL OR _operacao IS NULL OR NOT public.pode_funcao(_empresa,'carga_criar')
  THEN RAISE EXCEPTION 'Apenas motorista autorizado ou administrador pode criar carga nesta empresa'; END IF;
  IF COALESCE(cardinality(_plaquetas),0)=0 OR cardinality(_plaquetas)<>(SELECT count(DISTINCT p) FROM unnest(_plaquetas) p)
  THEN RAISE EXCEPTION 'Selecione toras sem repetição'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_empresa::text,0));
  SELECT id INTO id_rom FROM public.romaneios WHERE operacao_id = _operacao;
  IF id_rom IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.romaneios WHERE id=id_rom AND empresa_id=_empresa) THEN RAISE EXCEPTION 'Operação já vinculada a outra empresa'; END IF;
    RETURN id_rom;
  END IF;
  PERFORM 1 FROM public.toras WHERE empresa_id=_empresa AND plaqueta=ANY(_plaquetas) ORDER BY plaqueta FOR UPDATE;
  SELECT count(*), coalesce(sum(volume),0), count(*) FILTER (WHERE carregada OR romaneio_id IS NOT NULL OR serrada_em IS NOT NULL)
    INTO encontradas, vol, invalidas FROM public.toras WHERE empresa_id=_empresa AND plaqueta=ANY(_plaquetas);
  qtd := cardinality(_plaquetas);
  IF encontradas <> qtd THEN RAISE EXCEPTION 'Há toras inexistentes ou de outra empresa'; END IF;
  IF invalidas > 0 THEN RAISE EXCEPTION 'Uma ou mais toras já foram carregadas'; END IF;
  IF NULLIF(trim(coalesce(_cab->>'placa','')),'') IS NULL THEN RAISE EXCEPTION 'Placa obrigatória'; END IF;
  INSERT INTO public.romaneios (empresa_id,placa,julieta,motorista,cpf,data,total_volume,qtd_toras,created_by,operacao_id)
  VALUES (_empresa,upper(trim(_cab->>'placa')),upper(trim(coalesce(_cab->>'julieta',''))),trim(coalesce(_cab->>'motorista','')),trim(coalesce(_cab->>'cpf','')),
    coalesce(NULLIF(_cab->>'data','')::date,current_date),vol,qtd,auth.uid(),_operacao)
  RETURNING id INTO id_rom;
  INSERT INTO public.registros (empresa_id,user_id,user_email,acao,detalhe,criado_em,lat,lng,operacao_id,mudancas)
  VALUES (_empresa,auth.uid(),auth.jwt()->>'email','Romaneio salvo',qtd||' toras · '||round(vol,4)||' m³ · placa '||(_cab->>'placa'),
    coalesce(NULLIF(_log->>'criado_em','')::timestamptz,now()),NULLIF(_log->>'lat','')::double precision,NULLIF(_log->>'lng','')::double precision,_operacao,'[]'::jsonb)
  RETURNING id INTO rid;
  PERFORM set_config('app.registro_contexto',rid::text,true);
  UPDATE public.toras SET carregada=true, romaneio_id=id_rom WHERE empresa_id=_empresa AND plaqueta=ANY(_plaquetas) AND NOT carregada AND romaneio_id IS NULL;
  GET DIAGNOSTICS encontradas = ROW_COUNT;
  IF encontradas <> qtd THEN RAISE EXCEPTION 'Falha ao vincular todas as toras; transação revertida'; END IF;
  PERFORM set_config('app.registro_contexto','',true);
  RETURN id_rom;
END $$;
REVOKE ALL ON FUNCTION public.salvar_romaneio_toras(uuid,jsonb,integer[],uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_romaneio_toras(uuid,jsonb,integer[],uuid,jsonb) TO authenticated;

-- Exclusão de carga ainda não recebida (somente administrador)
CREATE OR REPLACE FUNCTION public.excluir_romaneio_toras(_empresa uuid, _id uuid, _log jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE rom public.romaneios; qtd integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_funcao(_empresa,'usuarios_gerenciar') THEN RAISE EXCEPTION 'Somente administradores podem excluir cargas'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_empresa::text,0));
  SELECT * INTO rom FROM public.romaneios WHERE id=_id AND empresa_id=_empresa FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Carga não encontrada nesta empresa'; END IF;
  IF rom.recebido_em IS NOT NULL THEN RAISE EXCEPTION 'Carga já recebida no pátio não pode ser excluída'; END IF;
  UPDATE public.toras SET carregada=false, romaneio_id=NULL WHERE empresa_id=_empresa AND romaneio_id=_id;
  GET DIAGNOSTICS qtd = ROW_COUNT;
  DELETE FROM public.romaneios WHERE id=_id AND empresa_id=_empresa;
  INSERT INTO public.registros(empresa_id,user_id,user_email,acao,detalhe,lat,lng,criado_em)
  VALUES(_empresa,auth.uid(),auth.jwt()->>'email','Romaneio excluído','Placa '||coalesce(rom.placa,'–')||' · '||qtd||' toras devolvidas ao estoque',
    NULLIF(_log->>'lat','')::double precision,NULLIF(_log->>'lng','')::double precision,coalesce(NULLIF(_log->>'criado_em','')::timestamptz,now()));
END $$;
REVOKE ALL ON FUNCTION public.excluir_romaneio_toras(uuid,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_romaneio_toras(uuid,uuid,jsonb) TO authenticated;

-- Operações de estoque com cargo reautorizado em todo envio
CREATE OR REPLACE FUNCTION public.registrar_operacao(_tipo text, _empresa uuid, _dados jsonb, _alvos jsonb, _log jsonb, _operacao uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE rid uuid; atual public.toras; nova public.toras; alvo jsonb; recibo public.romaneios; quando timestamptz; anterior_contexto text;
BEGIN
  IF auth.uid() IS NULL OR _empresa IS NULL OR NOT (_empresa=public.minha_empresa() OR public.has_role(auth.uid(),'superadmin')) THEN RAISE EXCEPTION 'Sem permissão para esta empresa'; END IF;
  IF _tipo='tora_insert' THEN
    IF COALESCE(_dados->>'origem','') NOT IN ('manejo','serraria') THEN RAISE EXCEPTION 'Informe a origem da medição'; END IF;
    IF NOT public.pode_funcao(_empresa, CASE WHEN _dados->>'origem'='manejo' THEN 'toras_lancar' ELSE 'serraria_operar' END) THEN RAISE EXCEPTION 'Cargo sem permissão para esta origem'; END IF;
  ELSIF _tipo='tora_update' THEN
    IF public.pode_funcao(_empresa,'usuarios_gerenciar') THEN NULL;
    ELSIF public.pode_funcao(_empresa,'serraria_operar') THEN
      IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(_alvos) a(value)
        LEFT JOIN public.toras t ON t.empresa_id=_empresa AND t.plaqueta=a.value::integer
        WHERE t.plaqueta IS NULL OR t.serrada_em IS NOT NULL OR (t.origem IS DISTINCT FROM 'serraria' AND NOT EXISTS (
          SELECT 1 FROM public.romaneios r WHERE r.id=t.romaneio_id AND r.empresa_id=t.empresa_id AND r.recebido_em IS NOT NULL)))
      THEN RAISE EXCEPTION 'Somente estoque recebido e não serrado pode ser medido'; END IF;
      IF EXISTS (SELECT 1 FROM jsonb_object_keys(_dados) k WHERE k NOT IN ('d_topo1','d_topo2','d_pe1','d_pe2','comprimento','volume'))
      THEN RAISE EXCEPTION 'Gerente de pátio só pode atualizar medidas nesta operação'; END IF;
    ELSE RAISE EXCEPTION 'Somente administradores podem editar toras'; END IF;
  ELSIF _tipo IN ('tora_delete','toras_delete') THEN
    IF NOT public.pode_funcao(_empresa,'usuarios_gerenciar') THEN RAISE EXCEPTION 'Somente administradores podem excluir toras'; END IF;
  ELSIF _tipo IN ('toras_serradas','romaneio_recebido') THEN
    IF NOT public.pode_funcao(_empresa,'serraria_operar') THEN RAISE EXCEPTION 'Cargo sem permissão para operar a serraria'; END IF;
    IF _tipo='toras_serradas' AND EXISTS (SELECT 1 FROM public.toras t WHERE t.empresa_id=_empresa
      AND t.plaqueta IN (SELECT value::integer FROM jsonb_array_elements_text(_alvos)) AND t.origem IS DISTINCT FROM 'serraria'
      AND NOT EXISTS (SELECT 1 FROM public.romaneios r WHERE r.id=t.romaneio_id AND r.empresa_id=t.empresa_id AND r.recebido_em IS NOT NULL))
    THEN RAISE EXCEPTION 'Tora ainda não recebida na serraria'; END IF;
  ELSE RAISE EXCEPTION 'Ação não suportada'; END IF;
  IF _operacao IS NULL THEN RAISE EXCEPTION 'Operação sem identificação'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_empresa::text,0));
  SELECT id INTO rid FROM public.registros WHERE operacao_id=_operacao AND empresa_id=_empresa;
  IF rid IS NOT NULL THEN RETURN rid; END IF;
  IF EXISTS (SELECT 1 FROM public.registros WHERE operacao_id=_operacao) THEN RAISE EXCEPTION 'Operação já vinculada a outra empresa'; END IF;
  quando:=coalesce((_log->>'criado_em')::timestamptz,now());
  INSERT INTO public.registros(empresa_id,user_id,user_email,acao,detalhe,lat,lng,criado_em,operacao_id,mudancas)
  VALUES(_empresa,auth.uid(),auth.jwt()->>'email',coalesce(_log->>'acao','Alteração de estoque'),_log->>'detalhe',(_log->>'lat')::double precision,(_log->>'lng')::double precision,quando,_operacao,'[]'::jsonb) RETURNING id INTO rid;
  anterior_contexto:=current_setting('app.registro_contexto',true);
  PERFORM set_config('app.registro_contexto',rid::text,true);
  IF _tipo='tora_insert' THEN
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(_dados) k WHERE k NOT IN ('plaqueta','arvore','secao','especie','nome_cientifico','autex','volume','d_topo1','d_topo2','d_pe1','d_pe2','comprimento','origem','carregada','empresa_id')) THEN RAISE EXCEPTION 'Campo não permitido ao lançar tora'; END IF;
    IF COALESCE((_dados->>'carregada')::boolean,false) THEN RAISE EXCEPTION 'Uma tora nova não pode ser marcada como carregada'; END IF;
    nova:=jsonb_populate_record(NULL::public.toras,jsonb_build_object('empresa_id',_empresa,'created_at',quando,'carregada',false,'volume',0)||_dados||jsonb_build_object('empresa_id',_empresa,'carregada',false,'romaneio_id',null,'serrada_em',null,'created_at',quando));
    nova.publico_id:=coalesce(nova.publico_id,gen_random_uuid());
    IF EXISTS(SELECT 1 FROM public.toras t WHERE t.empresa_id=_empresa AND t.arvore=nova.arvore AND upper(trim(coalesce(t.secao,'')))=upper(trim(coalesce(nova.secao,''))) AND regexp_replace(upper(trim(coalesce(t.autex,''))),'^AUTEX[[:space:]:-]*','')=regexp_replace(upper(trim(coalesce(nova.autex,''))),'^AUTEX[[:space:]:-]*','')) THEN RAISE EXCEPTION 'Árvore e secção já lançadas nesta AUTEX'; END IF;
    INSERT INTO public.toras SELECT nova.*;
  ELSIF _tipo='romaneio_recebido' THEN
    SELECT * INTO recibo FROM public.romaneios WHERE id=(_alvos->>0)::uuid AND empresa_id=_empresa FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Romaneio não encontrado nesta empresa'; END IF;
    IF recibo.recebido_em IS NOT NULL THEN RAISE EXCEPTION 'Esta carga já foi recebida'; END IF;
    IF nullif(trim(_dados->>'patio'),'') IS NULL THEN RAISE EXCEPTION 'Escolha o pátio'; END IF;
    INSERT INTO public.patios(nome,empresa_id) VALUES(trim(_dados->>'patio'),_empresa) ON CONFLICT(empresa_id,nome) DO NOTHING;
    UPDATE public.romaneios SET recebido_em=quando,patio=trim(_dados->>'patio') WHERE id=recibo.id AND empresa_id=_empresa;
  ELSE
    FOR alvo IN SELECT value FROM jsonb_array_elements(_alvos) LOOP
      SELECT * INTO atual FROM public.toras WHERE empresa_id=_empresa AND plaqueta=(alvo#>>'{}')::integer FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Tora não encontrada nesta empresa'; END IF;
      IF _tipo IN ('tora_delete','toras_delete') THEN DELETE FROM public.toras WHERE empresa_id=_empresa AND plaqueta=atual.plaqueta;
      ELSIF _tipo='toras_serradas' THEN
        UPDATE public.toras SET serrada_em=CASE WHEN coalesce((_dados->>'desfazer')::boolean,false) THEN NULL ELSE quando END WHERE empresa_id=_empresa AND plaqueta=atual.plaqueta;
      ELSE
        IF EXISTS(SELECT 1 FROM jsonb_object_keys(_dados) k WHERE k NOT IN ('plaqueta','arvore','secao','especie','nome_cientifico','autex','volume','d_topo1','d_topo2','d_pe1','d_pe2','comprimento')) THEN RAISE EXCEPTION 'Campo de edição não permitido'; END IF;
        nova:=jsonb_populate_record(NULL::public.toras,to_jsonb(atual)||_dados);
        IF EXISTS(SELECT 1 FROM public.toras t WHERE t.empresa_id=_empresa AND t.plaqueta<>atual.plaqueta AND t.arvore=nova.arvore AND upper(trim(coalesce(t.secao,'')))=upper(trim(coalesce(nova.secao,''))) AND regexp_replace(upper(trim(coalesce(t.autex,''))),'^AUTEX[[:space:]:-]*','')=regexp_replace(upper(trim(coalesce(nova.autex,''))),'^AUTEX[[:space:]:-]*','')) THEN RAISE EXCEPTION 'Árvore e secção já lançadas nesta AUTEX'; END IF;
        IF nova.autex IS NOT NULL THEN INSERT INTO public.autex(numero,empresa_id) VALUES(nova.autex,_empresa) ON CONFLICT(empresa_id,numero) DO NOTHING; END IF;
        UPDATE public.toras SET plaqueta=nova.plaqueta,arvore=nova.arvore,secao=nova.secao,especie=nova.especie,nome_cientifico=nova.nome_cientifico,autex=nova.autex,volume=nova.volume,d_topo1=nova.d_topo1,d_topo2=nova.d_topo2,d_pe1=nova.d_pe1,d_pe2=nova.d_pe2,comprimento=nova.comprimento WHERE empresa_id=_empresa AND plaqueta=atual.plaqueta;
      END IF;
    END LOOP;
  END IF;
  PERFORM set_config('app.registro_contexto',coalesce(anterior_contexto,''),true);
  RETURN rid;
END $function$;

-- Importação atômica da ficha (somente administração)
CREATE OR REPLACE FUNCTION public.importar_ficha_manejo(_empresa uuid, _arvores jsonb, _toras jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE qtd_arvores integer; qtd_toras integer;
BEGIN
  IF auth.uid() IS NULL OR _empresa IS NULL OR NOT public.pode_funcao(_empresa,'base_importar') THEN RAISE EXCEPTION 'Apenas administradores da empresa podem importar fichas'; END IF;
  IF jsonb_typeof(_arvores) <> 'array' OR jsonb_typeof(_toras) <> 'array' THEN RAISE EXCEPTION 'Arquivo de importação inválido'; END IF;
  qtd_arvores := jsonb_array_length(_arvores); qtd_toras := jsonb_array_length(_toras);
  IF qtd_arvores < 1 THEN RAISE EXCEPTION 'Nenhuma árvore para importar'; END IF;
  IF qtd_arvores > 10000 OR qtd_toras > 10000 THEN RAISE EXCEPTION 'Arquivo muito grande. Divida a ficha em arquivos menores de até 10000 itens'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_empresa::text,0));
  INSERT INTO public.autex(empresa_id, numero)
  SELECT DISTINCT _empresa, a.autex FROM jsonb_to_recordset(_arvores) AS a(autex text) WHERE NULLIF(trim(a.autex),'') IS NOT NULL
  ON CONFLICT(empresa_id,numero) DO NOTHING;
  INSERT INTO public.arvores (empresa_id,numero,autex,nome_vulgar,nome_cientifico,cap,dap,altura,volume,categoria,picada,latitude,longitude,localizado_em)
  SELECT _empresa,a.numero,a.autex,a.nome_vulgar,a.nome_cientifico,a.cap,a.dap,a.altura,a.volume,a.categoria,a.picada,a.latitude,a.longitude,
    CASE WHEN a.latitude IS NOT NULL AND a.longitude IS NOT NULL THEN now() ELSE NULL END
  FROM jsonb_to_recordset(_arvores) AS a(numero integer,autex text,nome_vulgar text,nome_cientifico text,cap numeric,dap numeric,altura numeric,volume numeric,categoria text,picada text,latitude double precision,longitude double precision)
  WHERE a.numero IS NOT NULL AND NULLIF(trim(a.autex),'') IS NOT NULL
  ON CONFLICT(empresa_id,numero,autex) DO UPDATE SET
    nome_vulgar=EXCLUDED.nome_vulgar,nome_cientifico=EXCLUDED.nome_cientifico,cap=EXCLUDED.cap,dap=EXCLUDED.dap,altura=EXCLUDED.altura,
    volume=EXCLUDED.volume,categoria=EXCLUDED.categoria,picada=EXCLUDED.picada,
    latitude=coalesce(EXCLUDED.latitude,public.arvores.latitude),longitude=coalesce(EXCLUDED.longitude,public.arvores.longitude),
    localizado_em=coalesce(EXCLUDED.localizado_em,public.arvores.localizado_em);
  INSERT INTO public.toras (empresa_id,plaqueta,arvore,secao,especie,nome_cientifico,autex,d_topo1,d_topo2,d_pe1,d_pe2,comprimento,volume,origem,carregada)
  SELECT _empresa,t.plaqueta,t.arvore,t.secao,t.especie,t.nome_cientifico,t.autex,t.d_topo1,t.d_topo2,t.d_pe1,t.d_pe2,t.comprimento,coalesce(t.volume,0),'manejo',coalesce(t.carregada,false)
  FROM jsonb_to_recordset(_toras) AS t(plaqueta integer,arvore integer,secao text,especie text,nome_cientifico text,autex text,d_topo1 numeric,d_topo2 numeric,d_pe1 numeric,d_pe2 numeric,comprimento numeric,volume numeric,origem text,carregada boolean)
  WHERE t.plaqueta IS NOT NULL AND t.arvore IS NOT NULL
  ON CONFLICT (empresa_id,plaqueta) DO NOTHING;
  RETURN jsonb_build_object('arvores',qtd_arvores,'toras',qtd_toras);
END $$;
REVOKE ALL ON FUNCTION public.importar_ficha_manejo(uuid,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.importar_ficha_manejo(uuid,jsonb,jsonb) TO authenticated;

-- Arrasto de toras (tratorista)
CREATE OR REPLACE FUNCTION public.registrar_arrasto_toras(_empresa uuid,_autex text,_arvore integer,_plaquetas integer[],_explanada uuid,_lat double precision,_lng double precision,_precisao double precision,_capturado_em timestamptz,_operacao uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE total integer; encontradas integer; previamente integer; mesma_operacao integer; abatida timestamptz; arvore_lat double precision; arvore_lng double precision; distancia_metros double precision; registro_id uuid; contexto_anterior text;
BEGIN
  IF auth.uid() IS NULL OR _empresa IS NULL OR NOT public.pode_funcao(_empresa,'mapa_arrastar') THEN RAISE EXCEPTION 'Você não tem permissão nesta empresa'; END IF;
  total := cardinality(_plaquetas);
  IF _operacao IS NULL OR nullif(btrim(_autex),'') IS NULL OR _arvore IS NULL OR _arvore <= 0 OR total IS NULL OR total < 1 OR total > 100
     OR total <> (SELECT count(DISTINCT p) FROM unnest(_plaquetas) AS p) OR EXISTS (SELECT 1 FROM unnest(_plaquetas) AS p WHERE p IS NULL OR p <= 0)
  THEN RAISE EXCEPTION 'Seleção de toras ou operação inválida'; END IF;
  IF _lat IS NULL OR _lng IS NULL OR _precisao IS NULL OR NOT (_lat BETWEEN -90 AND 90 AND _lng BETWEEN -180 AND 180) OR NOT (_precisao BETWEEN 0 AND 100)
  THEN RAISE EXCEPTION 'GPS inválido ou com precisão insuficiente'; END IF;
  IF _capturado_em IS NULL OR _capturado_em > now() + interval '1 minute' OR _capturado_em < now() - interval '30 days'
  THEN RAISE EXCEPTION 'Data da captura GPS inválida ou muito antiga'; END IF;
  IF _explanada IS NULL OR NOT EXISTS (SELECT 1 FROM public.explanadas e WHERE e.id=_explanada AND e.empresa_id=_empresa AND e.autex=_autex)
  THEN RAISE EXCEPTION 'Explanada de destino inválida para a empresa/AUTEX'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_empresa::text,0));
  SELECT a.abatida_em,a.latitude,a.longitude INTO abatida,arvore_lat,arvore_lng FROM public.arvores a WHERE a.empresa_id=_empresa AND a.autex=_autex AND a.numero=_arvore LIMIT 1 FOR SHARE;
  IF NOT FOUND OR abatida IS NULL THEN RAISE EXCEPTION 'Registre o abate da árvore antes do arrasto'; END IF;
  IF arvore_lat IS NULL OR arvore_lng IS NULL THEN RAISE EXCEPTION 'Localize a árvore no mapa antes do arrasto'; END IF;
  IF _capturado_em < abatida - interval '1 minute' THEN RAISE EXCEPTION 'O arrasto não pode ser anterior ao abate'; END IF;
  distancia_metros := 111195 * sqrt(power(_lat-arvore_lat,2) + power((_lng-arvore_lng)*cos(radians(arvore_lat)),2));
  IF distancia_metros > 100 THEN RAISE EXCEPTION 'Tratorista a mais de 100 metros da árvore'; END IF;
  PERFORM 1 FROM public.toras WHERE empresa_id=_empresa AND plaqueta=ANY(_plaquetas) ORDER BY plaqueta FOR UPDATE;
  SELECT count(*), count(*) FILTER (WHERE arrastada_em IS NOT NULL), count(*) FILTER (WHERE arrasto_operacao_id=_operacao)
    INTO encontradas, previamente, mesma_operacao FROM public.toras
  WHERE empresa_id=_empresa AND autex=_autex AND arvore=_arvore AND origem='manejo' AND plaqueta=ANY(_plaquetas);
  IF encontradas <> total THEN RAISE EXCEPTION 'Há toras inexistentes ou não vinculadas à árvore/AUTEX'; END IF;
  IF previamente=total AND mesma_operacao=total THEN RETURN total; END IF;
  IF previamente>0 THEN RAISE EXCEPTION 'Uma ou mais toras já foram arrastadas; revise a lista'; END IF;
  IF EXISTS (SELECT 1 FROM public.toras WHERE empresa_id=_empresa AND plaqueta=ANY(_plaquetas) AND (carregada OR romaneio_id IS NOT NULL))
  THEN RAISE EXCEPTION 'Tora já carregada para serraria não pode receber novo arrasto'; END IF;
  INSERT INTO public.registros (empresa_id,user_id,user_email,acao,detalhe,lat,lng,criado_em,operacao_id,mudancas)
  VALUES (_empresa,auth.uid(),auth.jwt()->>'email','Arrasto concluído','Árvore '||_arvore||' · AUTEX '||_autex||' · '||total||' tora(s) · plaquetas '||array_to_string(_plaquetas,', ')||' · explanada '||_explanada,_lat,_lng,_capturado_em,_operacao,'[]'::jsonb)
  RETURNING id INTO registro_id;
  contexto_anterior := current_setting('app.registro_contexto',true);
  PERFORM set_config('app.registro_contexto',registro_id::text,true);
  UPDATE public.toras SET arrastada_em=_capturado_em, arrastada_por=auth.uid(), arrasto_operacao_id=_operacao, arrasto_lat=_lat, arrasto_lng=_lng, arrasto_explanada_id=_explanada
  WHERE empresa_id=_empresa AND autex=_autex AND arvore=_arvore AND plaqueta=ANY(_plaquetas) AND origem='manejo' AND arrastada_em IS NULL AND NOT carregada AND romaneio_id IS NULL;
  GET DIAGNOSTICS encontradas = ROW_COUNT;
  IF encontradas<>total THEN RAISE EXCEPTION 'Falha ao registrar todas as toras; nenhum arrasto foi gravado'; END IF;
  PERFORM set_config('app.registro_contexto',coalesce(contexto_anterior,''),true);
  RETURN encontradas;
END $$;
REVOKE ALL ON FUNCTION public.registrar_arrasto_toras(uuid,text,integer,integer[],uuid,double precision,double precision,double precision,timestamptz,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_arrasto_toras(uuid,text,integer,integer[],uuid,double precision,double precision,double precision,timestamptz,uuid) TO authenticated;

-- Madeira serrada: gerente de pátio ou administrador (guarda inserida na definição atual)
DO $$
DECLARE definicao text; assinatura regprocedure; cabecalho text := E'\nBEGIN\n'; verificacao text;
BEGIN
  FOR assinatura IN SELECT unnest(ARRAY[
    'public.salvar_pacote_serrado(uuid,uuid,jsonb,jsonb,jsonb)'::regprocedure,
    'public.excluir_pacote_serrado(uuid,uuid,jsonb)'::regprocedure,
    'public.salvar_carga_serrada(uuid,uuid,jsonb,uuid[],jsonb)'::regprocedure,
    'public.excluir_carga_serrada(uuid,uuid,jsonb)'::regprocedure]) LOOP
    definicao := pg_get_functiondef(assinatura);
    IF position('pode_funcao(_empresa, ''serraria_operar'')' IN definicao) > 0 THEN CONTINUE; END IF;
    IF position(cabecalho IN definicao)=0 THEN RAISE EXCEPTION 'Assinatura/estrutura desconhecida: %', assinatura; END IF;
    verificacao := E' IF NOT public.pode_funcao(_empresa, ''serraria_operar'') THEN RAISE EXCEPTION ''Cargo sem permissão para operar a serraria''; END IF;\n';
    definicao := overlay(definicao placing (cabecalho || verificacao) from position(cabecalho IN definicao) for length(cabecalho));
    EXECUTE definicao;
  END LOOP;
END $$;