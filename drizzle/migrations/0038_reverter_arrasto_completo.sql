CREATE OR REPLACE FUNCTION public.reverter_registro(_registro uuid, _log jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      IF antes IS NOT NULL AND depois IS NOT NULL AND NOT (antes ?& ARRAY['arrastada_em','arrastada_por','arrasto_operacao_id','arrasto_lat','arrasto_lng','arrasto_explanada_id'] AND depois ?& ARRAY['arrastada_em','arrastada_por','arrasto_operacao_id','arrasto_lat','arrasto_lng','arrasto_explanada_id']) THEN
        RAISE EXCEPTION 'Registro sem snapshot completo de arrasto/explanada; não reversível';
      END IF;
      IF nullif(antes->>'arrasto_explanada_id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.explanadas e WHERE e.id=(antes->>'arrasto_explanada_id')::uuid AND e.empresa_id=emp) THEN
        RAISE EXCEPTION 'A explanada original não existe mais; reversão bloqueada';
      END IF;
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
          UPDATE public.toras SET plaqueta=t.plaqueta,arvore=t.arvore,especie=t.especie,secao=t.secao,d_topo1=t.d_topo1,d_topo2=t.d_topo2,d_pe1=t.d_pe1,d_pe2=t.d_pe2,comprimento=t.comprimento,volume=t.volume,carregada=t.carregada,romaneio_id=t.romaneio_id,created_at=t.created_at,autex=t.autex,nome_cientifico=t.nome_cientifico,serrada_em=t.serrada_em,etiqueta_impressa_em=t.etiqueta_impressa_em,arrastada_em=t.arrastada_em,arrastada_por=t.arrastada_por,arrasto_operacao_id=t.arrasto_operacao_id,arrasto_lat=t.arrasto_lat,arrasto_lng=t.arrasto_lng,arrasto_explanada_id=t.arrasto_explanada_id WHERE empresa_id=emp AND plaqueta=(depois->>'plaqueta')::integer;
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
END $function$;