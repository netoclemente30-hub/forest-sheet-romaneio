CREATE OR REPLACE FUNCTION public.registrar_operacao(_tipo text,_empresa uuid,_dados jsonb,_alvos jsonb,_log jsonb,_operacao uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid uuid; atual public.toras; nova public.toras; alvo jsonb; recibo public.romaneios; quando timestamptz; anterior_contexto text;
BEGIN
  IF auth.uid() IS NULL OR _empresa IS NULL OR NOT (_empresa=public.minha_empresa() OR public.has_role(auth.uid(),'superadmin')) THEN RAISE EXCEPTION 'Sem permissão para esta empresa'; END IF;
  IF _operacao IS NULL THEN RAISE EXCEPTION 'Operação sem identificação'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_empresa::text,0));
  SELECT id INTO rid FROM public.registros WHERE operacao_id=_operacao AND empresa_id=_empresa;
  IF rid IS NOT NULL THEN RETURN rid; END IF;
  IF _tipo NOT IN ('tora_insert','tora_update','tora_delete','toras_delete','toras_serradas','romaneio_recebido') THEN RAISE EXCEPTION 'Ação não suportada'; END IF;
  quando:=coalesce((_log->>'criado_em')::timestamptz,now());
  INSERT INTO public.registros(empresa_id,user_id,user_email,acao,detalhe,lat,lng,criado_em,operacao_id,mudancas)
  VALUES(_empresa,auth.uid(),auth.jwt()->>'email',coalesce(_log->>'acao','Alteração de estoque'),_log->>'detalhe',(_log->>'lat')::double precision,(_log->>'lng')::double precision,quando,_operacao,'[]'::jsonb) RETURNING id INTO rid;
  anterior_contexto:=current_setting('app.registro_contexto',true);
  PERFORM set_config('app.registro_contexto',rid::text,true);
  IF _tipo='tora_insert' THEN
    nova:=jsonb_populate_record(NULL::public.toras,jsonb_build_object('empresa_id',_empresa,'created_at',quando,'carregada',false,'volume',0)||_dados||jsonb_build_object('empresa_id',_empresa));
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
END $$;
REVOKE ALL ON FUNCTION public.registrar_operacao(text,uuid,jsonb,jsonb,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.registrar_operacao(text,uuid,jsonb,jsonb,jsonb,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reverter_registro(_registro uuid,_log jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE reg public.registros; rid uuid; m jsonb; antes jsonb; depois jsonb; corrente jsonb; t public.toras; rom public.romaneios; emp uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin')) THEN RAISE EXCEPTION 'Somente administradores podem reverter'; END IF;
  SELECT empresa_id INTO emp FROM public.registros WHERE id=_registro;
  IF emp IS NULL OR NOT(emp=public.minha_empresa() OR public.has_role(auth.uid(),'superadmin')) THEN RAISE EXCEPTION 'Sem permissão para esta empresa'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(emp::text,0));
  SELECT * INTO reg FROM public.registros WHERE id=_registro FOR UPDATE;
  IF reg.revertido_em IS NOT NULL THEN RAISE EXCEPTION 'Registro já revertido'; END IF;
  IF reg.reversao_de IS NOT NULL OR reg.mudancas IS NULL OR jsonb_array_length(reg.mudancas)=0 THEN RAISE EXCEPTION 'Registro antigo sem dados suficientes para reverter'; END IF;
  INSERT INTO public.registros(empresa_id,user_id,user_email,acao,detalhe,lat,lng,criado_em,reversao_de,mudancas) VALUES(emp,auth.uid(),auth.jwt()->>'email','Registro revertido','Reversão do registro #'||reg.numero,(_log->>'lat')::double precision,(_log->>'lng')::double precision,now(),reg.id,'[]'::jsonb) RETURNING id INTO rid;
  PERFORM set_config('app.registro_contexto',rid::text,true);
  FOR m IN SELECT value FROM jsonb_array_elements(reg.mudancas) WITH ORDINALITY x(value,n) ORDER BY n DESC LOOP
    antes:=nullif(m->'antes','null'::jsonb); depois:=nullif(m->'depois','null'::jsonb);
    IF (coalesce(antes,depois)->>'empresa_id')::uuid IS DISTINCT FROM emp THEN RAISE EXCEPTION 'Empresa do registro inválida'; END IF;
    IF m->>'tabela'='toras' THEN
      SELECT to_jsonb(x) INTO corrente FROM public.toras x WHERE empresa_id=emp AND plaqueta=(coalesce(depois,antes)->>'plaqueta')::integer FOR UPDATE;
      IF depois IS NULL THEN
        IF corrente IS NOT NULL THEN RAISE EXCEPTION 'Esta plaqueta já foi utilizada novamente'; END IF;
        t:=jsonb_populate_record(NULL::public.toras,antes);
        t.publico_id:=coalesce(t.publico_id,gen_random_uuid());
        IF EXISTS(SELECT 1 FROM public.toras x WHERE x.empresa_id=emp AND x.arvore=t.arvore AND upper(trim(coalesce(x.secao,'')))=upper(trim(coalesce(t.secao,''))) AND regexp_replace(upper(trim(coalesce(x.autex,''))),'^AUTEX[[:space:]:-]*','')=regexp_replace(upper(trim(coalesce(t.autex,''))),'^AUTEX[[:space:]:-]*','')) THEN RAISE EXCEPTION 'Esta árvore e secção já foram utilizadas'; END IF;
        IF t.autex IS NOT NULL THEN INSERT INTO public.autex(numero,empresa_id) VALUES(t.autex,emp) ON CONFLICT(empresa_id,numero) DO NOTHING; END IF;
        INSERT INTO public.toras SELECT t.*;
      ELSE
        IF corrente IS DISTINCT FROM depois THEN RAISE EXCEPTION 'A tora mudou depois deste registro; reverta primeiro a alteração mais recente'; END IF;
        IF antes IS NULL THEN
          IF coalesce((corrente->>'carregada')::boolean,false) OR corrente->>'romaneio_id' IS NOT NULL OR corrente->>'serrada_em' IS NOT NULL THEN RAISE EXCEPTION 'A tora já foi carregada ou serrada'; END IF;
          DELETE FROM public.toras WHERE empresa_id=emp AND plaqueta=(depois->>'plaqueta')::integer;
        ELSE
          t:=jsonb_populate_record(NULL::public.toras,antes);
          IF EXISTS(SELECT 1 FROM public.toras x WHERE x.empresa_id=emp AND x.plaqueta<>(depois->>'plaqueta')::integer AND (x.plaqueta=t.plaqueta OR (x.arvore=t.arvore AND upper(trim(coalesce(x.secao,'')))=upper(trim(coalesce(t.secao,''))) AND regexp_replace(upper(trim(coalesce(x.autex,''))),'^AUTEX[[:space:]:-]*','')=regexp_replace(upper(trim(coalesce(t.autex,''))),'^AUTEX[[:space:]:-]*','')))) THEN RAISE EXCEPTION 'Plaqueta ou identidade anterior já utilizada'; END IF;
          UPDATE public.toras SET plaqueta=t.plaqueta,arvore=t.arvore,especie=t.especie,secao=t.secao,d_topo1=t.d_topo1,d_topo2=t.d_topo2,d_pe1=t.d_pe1,d_pe2=t.d_pe2,comprimento=t.comprimento,volume=t.volume,carregada=t.carregada,romaneio_id=t.romaneio_id,created_at=t.created_at,autex=t.autex,nome_cientifico=t.nome_cientifico,serrada_em=t.serrada_em,etiqueta_impressa_em=t.etiqueta_impressa_em WHERE empresa_id=emp AND plaqueta=(depois->>'plaqueta')::integer;
        END IF;
      END IF;
    ELSIF m->>'tabela'='romaneios' THEN
      SELECT to_jsonb(x) INTO corrente FROM public.romaneios x WHERE empresa_id=emp AND id=(depois->>'id')::uuid FOR UPDATE;
      IF corrente IS DISTINCT FROM depois THEN RAISE EXCEPTION 'O romaneio mudou depois deste registro'; END IF;
      IF EXISTS(SELECT 1 FROM public.toras WHERE empresa_id=emp AND romaneio_id=(depois->>'id')::uuid AND serrada_em IS NOT NULL) THEN RAISE EXCEPTION 'O romaneio tem toras serradas'; END IF;
      rom:=jsonb_populate_record(NULL::public.romaneios,antes);
      UPDATE public.romaneios SET placa=rom.placa,julieta=rom.julieta,motorista=rom.motorista,cpf=rom.cpf,data=rom.data,total_volume=rom.total_volume,qtd_toras=rom.qtd_toras,recebido_em=rom.recebido_em,patio=rom.patio WHERE id=rom.id AND empresa_id=emp;
      UPDATE public.toras SET carregada=false,romaneio_id=NULL WHERE empresa_id=emp AND romaneio_id=rom.id;
      IF antes->'toras' IS NOT NULL THEN
        UPDATE public.toras t SET carregada=true,romaneio_id=rom.id FROM jsonb_array_elements(antes->'toras') e WHERE t.empresa_id=emp AND t.plaqueta=(e.value#>>'{}')::integer;
      END IF;
    END IF;
  END LOOP;
  PERFORM set_config('app.registro_contexto','',true);
  RETURN rid;
END $$;
REVOKE ALL ON FUNCTION public.reverter_registro(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reverter_registro(uuid,jsonb) TO authenticated;