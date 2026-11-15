-- Migração não destrutiva. Aplicar com backup e testar em homologação antes da produção.
-- Idempotência de romaneios, auditoria autenticada, controles de exclusão e separação de empresas.
-- Não permitir que um admin comum consulte vínculos/empresas de todos os clientes.
DROP POLICY IF EXISTS "usuario le proprio vinculo" ON public.empresa_usuarios;
CREATE POLICY "usuario le proprio vinculo" ON public.empresa_usuarios
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (empresa_id = public.minha_empresa() AND public.has_role(auth.uid(),'admin'))
  OR public.has_role(auth.uid(),'superadmin')
);

-- A política FOR ALL legada permitiria que administradores comuns continuassem
-- lendo outras empresas, apesar da nova política de leitura específica.
DROP POLICY IF EXISTS "admin gerencia empresas" ON public.empresas;
CREATE POLICY "somente superadmin gerencia empresas" ON public.empresas
FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'superadmin'))
WITH CHECK (public.has_role(auth.uid(),'superadmin'));

DROP POLICY IF EXISTS "usuario le a propria empresa" ON public.empresas;
CREATE POLICY "usuario le a propria empresa" ON public.empresas
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.empresa_id = empresas.id AND eu.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(),'superadmin')
);

-- Reduzir os grants legados que não devem ser expostos pela Data API.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.registros FROM anon, authenticated;

ALTER TABLE public.romaneios ADD COLUMN IF NOT EXISTS operacao_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS romaneios_operacao_unica ON public.romaneios(operacao_id) WHERE operacao_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS empresas_cnpj_unico ON public.empresas(cnpj) WHERE cnpj IS NOT NULL;

-- Relação composta: uma tora não pode apontar para romaneio de outra empresa.
CREATE UNIQUE INDEX IF NOT EXISTS romaneios_empresa_id_id_unique ON public.romaneios(empresa_id,id);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='toras_romaneio_empresa_fkey') THEN
    ALTER TABLE public.toras
      ADD CONSTRAINT toras_romaneio_empresa_fkey
      FOREIGN KEY (empresa_id,romaneio_id)
      REFERENCES public.romaneios(empresa_id,id)
      ON DELETE SET NULL (romaneio_id) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.toras VALIDATE CONSTRAINT toras_romaneio_empresa_fkey;

-- Evitar que operadores excluam toras diretamente; escritas operacionais permanecem.
DROP POLICY IF EXISTS "empresa toras" ON public.toras;
DROP POLICY IF EXISTS "empresa toras select" ON public.toras;
DROP POLICY IF EXISTS "empresa toras insert" ON public.toras;
DROP POLICY IF EXISTS "empresa toras update" ON public.toras;
DROP POLICY IF EXISTS "empresa toras delete admin" ON public.toras;
CREATE POLICY "empresa toras select" ON public.toras FOR SELECT TO authenticated
USING (empresa_id = public.minha_empresa() OR public.has_role(auth.uid(),'superadmin'));
CREATE POLICY "empresa toras insert" ON public.toras FOR INSERT TO authenticated
WITH CHECK (
  (empresa_id = public.minha_empresa() AND public.has_role(auth.uid(),'admin'))
  OR public.has_role(auth.uid(),'superadmin')
);
CREATE POLICY "empresa toras update" ON public.toras FOR UPDATE TO authenticated
USING (empresa_id = public.minha_empresa() OR public.has_role(auth.uid(),'superadmin'))
WITH CHECK (empresa_id = public.minha_empresa() OR public.has_role(auth.uid(),'superadmin'));
-- Operadores só podem marcar etiquetas via Data API; mudanças de estoque
-- exigem funções transacionais SECURITY DEFINER com validação de permissão.
REVOKE UPDATE ON public.toras FROM PUBLIC, anon, authenticated;
GRANT UPDATE(etiqueta_impressa_em) ON public.toras TO authenticated;

CREATE POLICY "empresa toras delete admin" ON public.toras FOR DELETE TO authenticated
USING (
  (empresa_id = public.minha_empresa() AND public.has_role(auth.uid(),'admin'))
  OR public.has_role(auth.uid(),'superadmin')
);

-- A tabela registros não concede INSERT para authenticated. O procedimento cria
-- o evento com user_id e e-mail derivados da sessão, não dos dados do navegador.
CREATE OR REPLACE FUNCTION public.registrar_evento(_empresa uuid, _log jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE emp uuid; rid uuid; op uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  emp := COALESCE(_empresa, public.minha_empresa());
  IF emp IS NULL AND NOT public.has_role(auth.uid(),'superadmin')
    THEN RAISE EXCEPTION 'Empresa não encontrada'; END IF;
  IF emp IS NOT NULL AND NOT (
    emp = public.minha_empresa() OR public.has_role(auth.uid(),'superadmin')
  ) THEN RAISE EXCEPTION 'Empresa não autorizada'; END IF;
  op := NULLIF(_log->>'operacao_id','')::uuid;
  IF op IS NOT NULL THEN
    SELECT id INTO rid FROM public.registros WHERE operacao_id = op;
    IF rid IS NOT NULL THEN RETURN rid; END IF;
  END IF;
  INSERT INTO public.registros (
    empresa_id,user_id,user_email,acao,detalhe,lat,lng,criado_em,
    operacao_id,aparelho_nome,aparelho_modelo,aparelho_ua
  ) VALUES (
    emp,auth.uid(),auth.jwt()->>'email',
    LEFT(COALESCE(NULLIF(_log->>'acao',''),'Evento registrado'),160),
    LEFT(COALESCE(_log->>'detalhe',''),1200),
    NULLIF(_log->>'lat','')::double precision,NULLIF(_log->>'lng','')::double precision,
    COALESCE(NULLIF(_log->>'criado_em','')::timestamptz,now()),op,
    LEFT(_log->>'aparelho_nome',120),LEFT(_log->>'aparelho_modelo',120),
    LEFT(_log->>'aparelho_ua',500)
  ) RETURNING id INTO rid;
  RETURN rid;
END $$;
REVOKE ALL ON FUNCTION public.registrar_evento(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.registrar_evento(uuid,jsonb) TO authenticated;

-- Grava a carga, vincula as toras e registra a auditoria numa única transação.
-- Não confia em totais, volumes, identificação da empresa ou permissões vindas do cliente.
CREATE OR REPLACE FUNCTION public.salvar_romaneio_toras(
  _empresa uuid, _cab jsonb, _plaquetas integer[], _operacao uuid, _log jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE rid uuid; id_rom uuid; qtd integer; vol numeric; bloqueadas integer; status_invalido integer;
BEGIN
  IF auth.uid() IS NULL OR _empresa IS NULL OR _operacao IS NULL OR NOT (
    _empresa = public.minha_empresa() OR public.has_role(auth.uid(),'superadmin')
  ) THEN RAISE EXCEPTION 'Acesso negado à empresa ou operação inválida'; END IF;
  IF COALESCE(cardinality(_plaquetas),0)=0 OR
    COALESCE(cardinality(_plaquetas),0)<>(
      SELECT count(DISTINCT p) FROM unnest(_plaquetas) p
    ) THEN RAISE EXCEPTION 'Selecione toras sem repetição'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_empresa::text,0));
  SELECT id INTO id_rom FROM public.romaneios WHERE operacao_id = _operacao;
  IF id_rom IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM public.romaneios WHERE id=id_rom AND empresa_id=_empresa)
      THEN RAISE EXCEPTION 'Operação já vinculada a outra empresa'; END IF;
    RETURN id_rom;
  END IF;
  -- Bloqueio em ordem fixa: evita que duas cargas simultâneas usem as mesmas toras.
  PERFORM 1 FROM public.toras WHERE empresa_id=_empresa AND plaqueta = ANY(_plaquetas)
    ORDER BY plaqueta FOR UPDATE;
  SELECT count(*),coalesce(sum(volume),0),
    count(*) FILTER(WHERE carregada OR romaneio_id IS NOT NULL)
  INTO bloqueadas,vol,status_invalido
    FROM public.toras WHERE empresa_id=_empresa AND plaqueta=ANY(_plaquetas);
  qtd := cardinality(_plaquetas);
  IF bloqueadas <> qtd THEN RAISE EXCEPTION 'Há toras inexistentes ou de outra empresa'; END IF;
  IF status_invalido > 0 THEN RAISE EXCEPTION 'Uma ou mais toras já foram carregadas'; END IF;
  IF NULLIF(trim(coalesce(_cab->>'placa','')),'') IS NULL THEN RAISE EXCEPTION 'Placa obrigatória'; END IF;
  INSERT INTO public.romaneios (
    empresa_id,placa,julieta,motorista,cpf,data,total_volume,qtd_toras,created_by,operacao_id
  ) VALUES (
    _empresa,upper(trim(_cab->>'placa')),upper(trim(coalesce(_cab->>'julieta',''))),
    trim(coalesce(_cab->>'motorista','')),trim(coalesce(_cab->>'cpf','')),
    coalesce(NULLIF(_cab->>'data','')::date,current_date),vol,qtd,auth.uid(),_operacao
  ) RETURNING id INTO id_rom;
  INSERT INTO public.registros (
    empresa_id,user_id,user_email,acao,detalhe,criado_em,lat,lng,operacao_id,mudancas
  ) VALUES (
    _empresa,auth.uid(),auth.jwt()->>'email','Romaneio salvo',
    qtd||' toras · '||round(vol,4)||' m³ · placa '||(_cab->>'placa'),
    coalesce(NULLIF(_log->>'criado_em','')::timestamptz,now()),
    NULLIF(_log->>'lat','')::double precision,NULLIF(_log->>'lng','')::double precision,
    _operacao,'[]'::jsonb
  ) RETURNING id INTO rid;
  PERFORM set_config('app.registro_contexto',rid::text,true);
  UPDATE public.toras SET carregada=true,romaneio_id=id_rom
  WHERE empresa_id=_empresa AND plaqueta=ANY(_plaquetas) AND NOT carregada;
  GET DIAGNOSTICS bloqueadas = ROW_COUNT;
  IF bloqueadas <> qtd THEN RAISE EXCEPTION 'Falha ao vincular todas as toras; transação revertida'; END IF;
  PERFORM set_config('app.registro_contexto','',true);
  RETURN id_rom;
END $$;
REVOKE ALL ON FUNCTION public.salvar_romaneio_toras(uuid,jsonb,integer[],uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.salvar_romaneio_toras(uuid,jsonb,integer[],uuid,jsonb) TO authenticated;

-- Restringir também a RPC legada: RLS não limita funções SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.registrar_operacao(_tipo text, _empresa uuid, _dados jsonb, _alvos jsonb, _log jsonb, _operacao uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE rid uuid; atual public.toras; nova public.toras; alvo jsonb; recibo public.romaneios; quando timestamptz; anterior_contexto text;
BEGIN
  IF auth.uid() IS NULL OR _empresa IS NULL OR NOT (_empresa=public.minha_empresa() OR public.has_role(auth.uid(),'superadmin')) THEN RAISE EXCEPTION 'Sem permissão para esta empresa'; END IF;
  -- A interface esconde edições/exclusões do operador, mas o banco deve impor a regra.
  IF _tipo IN ('tora_update','tora_delete','toras_delete')
    AND NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
  THEN RAISE EXCEPTION 'Somente administradores podem editar ou excluir toras'; END IF;
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
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(_dados) k WHERE k NOT IN
      ('plaqueta','arvore','secao','especie','nome_cientifico','autex',
       'volume','d_topo1','d_topo2','d_pe1','d_pe2','comprimento',
       'origem','carregada','empresa_id')) THEN
      RAISE EXCEPTION 'Campo não permitido ao lançar tora';
    END IF;
    IF COALESCE((_dados->>'carregada')::boolean,false) THEN
      RAISE EXCEPTION 'Uma tora nova não pode ser marcada como carregada';
    END IF;
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
