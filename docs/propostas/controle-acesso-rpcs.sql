-- PROPOSTA DE ENDURECIMENTO DE RPCs PRIVILEGIADAS — não executada.
-- Requer primeiro docs/propostas/funcoes-funcionarios.sql e a implantação
-- segura das migrações legadas 0036/0037 pela Lovable. Todas as funções devem
-- ser verificadas pela equipe antes de executar contra um banco real.
--
-- Funções SECURITY DEFINER ignoram RLS. Por isso é obrigatório impor o cargo
-- DENTRO de cada função, e não apenas nos botões da interface.

BEGIN;
DO $$
DECLARE definicao text; assinatura regprocedure; acao text;
DECLARE cabecalho text := E'\nBEGIN\n';
DECLARE verificacao text;
BEGIN
  -- O motorista só pode emitir a carga pelo servidor. Essa RPC já valida
  -- empresa, placas, toras bloqueadas e idempotência na versão 0036.
  assinatura := 'public.salvar_romaneio_toras(uuid,jsonb,integer[],uuid,jsonb)'::regprocedure;
  definicao := pg_get_functiondef(assinatura);
  IF position(cabecalho IN definicao)=0 THEN
    RAISE EXCEPTION 'Assinatura/estrutura desconhecida: %', assinatura;
  END IF;
  verificacao := E'  IF NOT public.pode_funcao(_empresa, ''carga_criar'') THEN\n' ||
                 E'    RAISE EXCEPTION ''Apenas motorista autorizado ou administrador pode criar carga'';\n' ||
                 E'  END IF;\n';
  definicao := overlay(definicao placing (cabecalho || verificacao) from position(cabecalho IN definicao) for length(cabecalho));
  EXECUTE definicao;

  -- Lançamentos e alterações de toras, recebimento de carga e serragem:
  -- negar operações pelo cargo antes da primeira gravação/auditoria.
  assinatura := 'public.registrar_operacao(text,uuid,jsonb,jsonb,jsonb,uuid)'::regprocedure;
  definicao := pg_get_functiondef(assinatura);
  IF position(cabecalho IN definicao)=0 THEN
    RAISE EXCEPTION 'Assinatura/estrutura desconhecida: %', assinatura;
  END IF;
  verificacao := $guard$
  -- Origem explícita: nunca inferir autorização de textos da auditoria.
  IF _tipo = 'tora_insert' THEN
    IF COALESCE(_dados->>'origem','') NOT IN ('manejo','serraria') THEN
      RAISE EXCEPTION 'Informe a origem da medição';
    END IF;
    IF NOT public.pode_funcao(_empresa,
      CASE WHEN _dados->>'origem'='manejo' THEN 'toras_lancar' ELSE 'serraria_operar' END)
      THEN RAISE EXCEPTION 'Cargo sem permissão para esta origem'; END IF;
  ELSIF _tipo='tora_update' AND public.pode_funcao(_empresa,'serraria_operar') THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(_alvos) a(value)
      LEFT JOIN public.toras t ON t.empresa_id=_empresa AND t.plaqueta=a.value::integer
      WHERE t.plaqueta IS NULL OR t.serrada_em IS NOT NULL OR
        (t.origem IS DISTINCT FROM 'serraria' AND NOT EXISTS (
          SELECT 1 FROM public.romaneios r WHERE r.id=t.romaneio_id
            AND r.empresa_id=t.empresa_id AND r.recebido_em IS NOT NULL))
    ) THEN RAISE EXCEPTION 'Somente estoque recebido e não serrado pode ser medido'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(_dados) k WHERE k NOT IN
      ('d_topo1','d_topo2','d_pe1','d_pe2','comprimento','volume'))
      THEN RAISE EXCEPTION 'Gerente de pátio só pode atualizar medidas nesta operação'; END IF;
  ELSIF _tipo IN ('tora_update','tora_delete','toras_delete') THEN
    IF NOT public.pode_funcao(_empresa,'usuarios_gerenciar')
      THEN RAISE EXCEPTION 'Somente administrador pode editar ou excluir lançamentos'; END IF;
  ELSIF _tipo IN ('toras_serradas','romaneio_recebido') THEN
    IF NOT public.pode_funcao(_empresa,'serraria_operar')
      THEN RAISE EXCEPTION 'Cargo sem permissão para operar a serraria'; END IF;
    IF _tipo='toras_serradas' AND EXISTS (
      SELECT 1 FROM public.toras t WHERE t.empresa_id=_empresa
      AND t.plaqueta IN (SELECT value::integer FROM jsonb_array_elements_text(_alvos))
      AND t.origem IS DISTINCT FROM 'serraria'
      AND NOT EXISTS (SELECT 1 FROM public.romaneios r
        WHERE r.id=t.romaneio_id AND r.empresa_id=t.empresa_id AND r.recebido_em IS NOT NULL)
    ) THEN RAISE EXCEPTION 'Tora ainda não recebida na serraria'; END IF;
  ELSE
    RAISE EXCEPTION 'Ação não autorizada';
  END IF;
$guard$;
  definicao := overlay(definicao placing (cabecalho || verificacao) from position(cabecalho IN definicao) for length(cabecalho));
  EXECUTE definicao;

  -- A versão 0036 tinha uma segunda guarda admin-only para qualquer update.
  -- Ajuste exato e verificável: a guarda acima já valida alvo e campos da serraria.
  assinatura := 'public.registrar_operacao(text,uuid,jsonb,jsonb,jsonb,uuid)'::regprocedure;
  definicao := pg_get_functiondef(assinatura);
  IF position('IF _tipo IN (''tora_update'',''tora_delete'',''toras_delete'')' IN definicao)=0 THEN
    RAISE EXCEPTION 'Revisar a guarda legada de registrar_operacao antes de implantar';
  END IF;
  definicao := replace(definicao,
    'IF _tipo IN (''tora_update'',''tora_delete'',''toras_delete'')',
    'IF (_tipo IN (''tora_delete'',''toras_delete'') OR (_tipo=''tora_update'' AND NOT public.pode_funcao(_empresa,''serraria_operar'')))');
  EXECUTE definicao;

  -- Auditoria avulsa também é escrita: escritório só registra o próprio login.
  assinatura := 'public.registrar_evento(uuid,jsonb)'::regprocedure;
  definicao := pg_get_functiondef(assinatura);
  IF position(cabecalho IN definicao)=0 THEN RAISE EXCEPTION 'Revisar registrar_evento'; END IF;
  verificacao := $guard$
  IF COALESCE(_log->>'acao','') <> 'Login' AND NOT (
    public.pode_funcao(COALESCE(_empresa,public.minha_empresa()),'usuarios_gerenciar')
    OR public.pode_funcao(COALESCE(_empresa,public.minha_empresa()),'mapa_abater')
    OR public.pode_funcao(COALESCE(_empresa,public.minha_empresa()),'mapa_arrastar')
    OR public.pode_funcao(COALESCE(_empresa,public.minha_empresa()),'toras_lancar')
    OR public.pode_funcao(COALESCE(_empresa,public.minha_empresa()),'carga_criar')
    OR public.pode_funcao(COALESCE(_empresa,public.minha_empresa()),'serraria_operar')
  ) THEN RAISE EXCEPTION 'Cargo somente consulta não pode registrar alterações'; END IF;
$guard$;
  definicao := overlay(definicao placing (cabecalho || verificacao) from position(cabecalho IN definicao) for length(cabecalho));
  EXECUTE definicao;

  -- Operações de madeira serrada: gerente de pátio ou administrador.
  -- Usar a definição final instalada no banco para preservar todas as
  -- melhorias posteriores de segurança e idempotência.
  FOR assinatura IN SELECT unnest(ARRAY[
    'public.salvar_pacote_serrado(uuid,uuid,jsonb,jsonb,jsonb)'::regprocedure,
    'public.excluir_pacote_serrado(uuid,uuid,jsonb)'::regprocedure,
    'public.salvar_carga_serrada(uuid,uuid,jsonb,uuid[],jsonb)'::regprocedure,
    'public.excluir_carga_serrada(uuid,uuid,jsonb)'::regprocedure
  ]) LOOP
    definicao := pg_get_functiondef(assinatura);
    IF position(cabecalho IN definicao)=0 THEN
      RAISE EXCEPTION 'Assinatura/estrutura desconhecida: %', assinatura;
    END IF;
    verificacao := E'  IF NOT public.pode_funcao(_empresa, ''serraria_operar'') THEN\n' ||
      E'    RAISE EXCEPTION ''Cargo sem permissão para operar a serraria''; END IF;\n';
    definicao := overlay(definicao placing (cabecalho || verificacao) from position(cabecalho IN definicao) for length(cabecalho));
    EXECUTE definicao;
  END LOOP;
END $$;

-- Funções de reversão e exclusão de manejo legadas já verificam administrador;
-- confirmar no ambiente de homologação que não há outras RPCs DEFINER abertas.
COMMIT;

-- Antes de implantar: conferir pg_proc/pg_policies com inventário atualizado,
-- inclusive funções futuras; testar com JWT real de cada um dos sete cargos,
-- duas empresas, ações no navegador e chamadas diretas à API, plus offline.
