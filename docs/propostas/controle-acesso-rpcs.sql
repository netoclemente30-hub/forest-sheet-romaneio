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
  definicao := replace(definicao, cabecalho, cabecalho || verificacao);
  EXECUTE definicao;

  -- Lançamentos e alterações de toras, recebimento de carga e serragem:
  -- negar operações pelo cargo antes da primeira gravação/auditoria.
  assinatura := 'public.registrar_operacao(text,uuid,jsonb,jsonb,jsonb,uuid)'::regprocedure;
  definicao := pg_get_functiondef(assinatura);
  IF position(cabecalho IN definicao)=0 THEN
    RAISE EXCEPTION 'Assinatura/estrutura desconhecida: %', assinatura;
  END IF;
  verificacao :=
    E'  IF _tipo = ''tora_insert'' AND NOT public.pode_funcao(_empresa,''toras_lancar'') THEN\n' ||
    E'    RAISE EXCEPTION ''Cargo sem permissão para lançar toras''; END IF;\n' ||
    E'  IF _tipo IN (''tora_update'',''tora_delete'',''toras_delete'')\n' ||
    E'     AND NOT public.pode_funcao(_empresa,''usuarios_gerenciar'') THEN\n' ||
    E'    RAISE EXCEPTION ''Somente administrador pode editar ou excluir lançamentos''; END IF;\n' ||
    E'  IF _tipo IN (''toras_serradas'',''romaneio_recebido'')\n' ||
    E'     AND NOT public.pode_funcao(_empresa,''serraria_operar'') THEN\n' ||
    E'    RAISE EXCEPTION ''Cargo sem permissão para operar a serraria''; END IF;\n';
  definicao := replace(definicao, cabecalho, cabecalho || verificacao);
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
    definicao := replace(definicao, cabecalho, cabecalho || verificacao);
    EXECUTE definicao;
  END LOOP;
END $$;

-- Funções de reversão e exclusão de manejo legadas já verificam administrador;
-- confirmar no ambiente de homologação que não há outras RPCs DEFINER abertas.
COMMIT;

-- Antes de implantar: conferir pg_proc/pg_policies com inventário atualizado,
-- inclusive funções futuras; testar com JWT real de cada um dos sete cargos,
-- duas empresas, ações no navegador e chamadas diretas à API, plus offline.
