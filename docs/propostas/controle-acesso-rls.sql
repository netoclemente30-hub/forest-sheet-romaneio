-- PROPOSTA PARA REVISÃO E HOMOLOGAÇÃO NA LOVABLE — NÃO EXECUTAR NO CHAT.
-- Requer docs/propostas/funcoes-funcionarios.sql antes, e o endurecimento de
-- TODAS as funções SECURITY DEFINER (docs/propostas/controle-acesso-rpcs.sql).
-- O conjunto substitui políticas legadas FOR ALL que ignoram a função do usuário.
-- ATENÇÃO: revisar diferenças de RLS com o banco atual antes de aplicar.
BEGIN;

-- Não alterar políticas de user_roles, empresa_usuarios e empresas neste pacote:
-- já há regras especializadas para administração e isolamento do cadastro.
DO $$
DECLARE tabela text; politica record;
BEGIN
  FOREACH tabela IN ARRAY ARRAY['arvores','autex','mapas_exploracao','rastros_gps','toras','romaneios','patios','veiculos','motoristas','toras_aguardando','saldos','pacotes_serrados','itens_pacote_serrado','romaneios_madeira_serrada','romaneio_carga_pacotes','registros'] LOOP
    FOR politica IN SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=tabela
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', politica.policyname,tabela);
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE public.arvores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funcao_arvores_ler" ON public.arvores FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'mapa_ver'));
CREATE POLICY "funcao_arvores_criar" ON public.arvores FOR INSERT TO authenticated WITH CHECK (public.pode_funcao(empresa_id,'usuarios_gerenciar'));
CREATE POLICY "funcao_arvores_editar" ON public.arvores FOR UPDATE TO authenticated USING (public.pode_funcao(empresa_id,'mapa_abater')) WITH CHECK (public.pode_funcao(empresa_id,'mapa_abater'));
CREATE POLICY "funcao_arvores_excluir" ON public.arvores FOR DELETE TO authenticated USING (public.pode_funcao(empresa_id,'usuarios_gerenciar'));

ALTER TABLE public.autex ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funcao_autex_ler" ON public.autex FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'mapa_ver') OR public.pode_funcao(empresa_id,'toras_ver') OR public.pode_funcao(empresa_id,'carga_criar') OR public.pode_funcao(empresa_id,'serraria_ver'));
CREATE POLICY "funcao_autex_criar" ON public.autex FOR INSERT TO authenticated WITH CHECK (public.pode_funcao(empresa_id,'base_importar'));
CREATE POLICY "funcao_autex_editar" ON public.autex FOR UPDATE TO authenticated USING (public.pode_funcao(empresa_id,'base_importar')) WITH CHECK (public.pode_funcao(empresa_id,'base_importar'));
CREATE POLICY "funcao_autex_excluir" ON public.autex FOR DELETE TO authenticated USING (public.pode_funcao(empresa_id,'base_importar'));

ALTER TABLE public.mapas_exploracao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funcao_mapas_exploracao_ler" ON public.mapas_exploracao FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'mapa_ver'));
CREATE POLICY "funcao_mapas_exploracao_criar" ON public.mapas_exploracao FOR INSERT TO authenticated WITH CHECK (public.pode_funcao(empresa_id,'base_importar'));
CREATE POLICY "funcao_mapas_exploracao_editar" ON public.mapas_exploracao FOR UPDATE TO authenticated USING (public.pode_funcao(empresa_id,'base_importar')) WITH CHECK (public.pode_funcao(empresa_id,'base_importar'));
CREATE POLICY "funcao_mapas_exploracao_excluir" ON public.mapas_exploracao FOR DELETE TO authenticated USING (public.pode_funcao(empresa_id,'base_importar'));

ALTER TABLE public.rastros_gps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funcao_rastros_gps_ler" ON public.rastros_gps FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'mapa_ver'));
CREATE POLICY "funcao_rastros_gps_criar" ON public.rastros_gps FOR INSERT TO authenticated WITH CHECK (public.pode_funcao(empresa_id,'mapa_rastrear'));
CREATE POLICY "funcao_rastros_gps_editar" ON public.rastros_gps FOR UPDATE TO authenticated USING (public.pode_funcao(empresa_id,'usuarios_gerenciar')) WITH CHECK (public.pode_funcao(empresa_id,'usuarios_gerenciar'));
CREATE POLICY "funcao_rastros_gps_excluir" ON public.rastros_gps FOR DELETE TO authenticated USING (public.pode_funcao(empresa_id,'usuarios_gerenciar'));

ALTER TABLE public.toras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funcao_toras_ler" ON public.toras FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'toras_ver'));
CREATE POLICY "funcao_toras_criar" ON public.toras FOR INSERT TO authenticated WITH CHECK (public.pode_funcao(empresa_id,'usuarios_gerenciar'));
CREATE POLICY "funcao_toras_editar" ON public.toras FOR UPDATE TO authenticated USING (public.pode_funcao(empresa_id,'usuarios_gerenciar')) WITH CHECK (public.pode_funcao(empresa_id,'usuarios_gerenciar'));
CREATE POLICY "funcao_toras_excluir" ON public.toras FOR DELETE TO authenticated USING (public.pode_funcao(empresa_id,'usuarios_gerenciar'));

ALTER TABLE public.romaneios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funcao_romaneios_ler" ON public.romaneios FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'carga_criar') OR public.pode_funcao(empresa_id,'serraria_ver'));
CREATE POLICY "funcao_romaneios_criar" ON public.romaneios FOR INSERT TO authenticated WITH CHECK (public.pode_funcao(empresa_id,'usuarios_gerenciar'));
CREATE POLICY "funcao_romaneios_editar" ON public.romaneios FOR UPDATE TO authenticated USING (public.pode_funcao(empresa_id,'usuarios_gerenciar')) WITH CHECK (public.pode_funcao(empresa_id,'usuarios_gerenciar'));
CREATE POLICY "funcao_romaneios_excluir" ON public.romaneios FOR DELETE TO authenticated USING (public.pode_funcao(empresa_id,'usuarios_gerenciar'));

ALTER TABLE public.patios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funcao_patios_ler" ON public.patios FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'serraria_ver'));
CREATE POLICY "funcao_patios_criar" ON public.patios FOR INSERT TO authenticated WITH CHECK (public.pode_funcao(empresa_id,'serraria_operar'));
CREATE POLICY "funcao_patios_editar" ON public.patios FOR UPDATE TO authenticated USING (public.pode_funcao(empresa_id,'usuarios_gerenciar')) WITH CHECK (public.pode_funcao(empresa_id,'usuarios_gerenciar'));
CREATE POLICY "funcao_patios_excluir" ON public.patios FOR DELETE TO authenticated USING (public.pode_funcao(empresa_id,'usuarios_gerenciar'));

ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funcao_veiculos_ler" ON public.veiculos FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'carga_criar'));
CREATE POLICY "funcao_veiculos_criar" ON public.veiculos FOR INSERT TO authenticated WITH CHECK (public.pode_funcao(empresa_id,'carga_criar'));
CREATE POLICY "funcao_veiculos_editar" ON public.veiculos FOR UPDATE TO authenticated USING (public.pode_funcao(empresa_id,'usuarios_gerenciar')) WITH CHECK (public.pode_funcao(empresa_id,'usuarios_gerenciar'));
CREATE POLICY "funcao_veiculos_excluir" ON public.veiculos FOR DELETE TO authenticated USING (public.pode_funcao(empresa_id,'usuarios_gerenciar'));

ALTER TABLE public.motoristas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funcao_motoristas_ler" ON public.motoristas FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'carga_criar'));
CREATE POLICY "funcao_motoristas_criar" ON public.motoristas FOR INSERT TO authenticated WITH CHECK (public.pode_funcao(empresa_id,'carga_criar'));
CREATE POLICY "funcao_motoristas_editar" ON public.motoristas FOR UPDATE TO authenticated USING (public.pode_funcao(empresa_id,'usuarios_gerenciar')) WITH CHECK (public.pode_funcao(empresa_id,'usuarios_gerenciar'));
CREATE POLICY "funcao_motoristas_excluir" ON public.motoristas FOR DELETE TO authenticated USING (public.pode_funcao(empresa_id,'usuarios_gerenciar'));

ALTER TABLE public.toras_aguardando ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funcao_toras_aguardando_ler" ON public.toras_aguardando FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'serraria_ver'));
CREATE POLICY "funcao_toras_aguardando_criar" ON public.toras_aguardando FOR INSERT TO authenticated WITH CHECK (public.pode_funcao(empresa_id,'serraria_operar'));
CREATE POLICY "funcao_toras_aguardando_editar" ON public.toras_aguardando FOR UPDATE TO authenticated USING (public.pode_funcao(empresa_id,'serraria_operar')) WITH CHECK (public.pode_funcao(empresa_id,'serraria_operar'));
CREATE POLICY "funcao_toras_aguardando_excluir" ON public.toras_aguardando FOR DELETE TO authenticated USING (public.pode_funcao(empresa_id,'serraria_operar'));

ALTER TABLE public.saldos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funcao_saldos_ler" ON public.saldos FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'serraria_ver'));
CREATE POLICY "funcao_saldos_criar" ON public.saldos FOR INSERT TO authenticated WITH CHECK (public.pode_funcao(empresa_id,'serraria_operar'));
CREATE POLICY "funcao_saldos_editar" ON public.saldos FOR UPDATE TO authenticated USING (public.pode_funcao(empresa_id,'serraria_operar')) WITH CHECK (public.pode_funcao(empresa_id,'serraria_operar'));
CREATE POLICY "funcao_saldos_excluir" ON public.saldos FOR DELETE TO authenticated USING (public.pode_funcao(empresa_id,'serraria_operar'));

ALTER TABLE public.pacotes_serrados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funcao_pacotes_serrados_ler" ON public.pacotes_serrados FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'serraria_ver'));
CREATE POLICY "funcao_pacotes_serrados_criar" ON public.pacotes_serrados FOR INSERT TO authenticated WITH CHECK (public.pode_funcao(empresa_id,'serraria_operar'));
CREATE POLICY "funcao_pacotes_serrados_editar" ON public.pacotes_serrados FOR UPDATE TO authenticated USING (public.pode_funcao(empresa_id,'serraria_operar')) WITH CHECK (public.pode_funcao(empresa_id,'serraria_operar'));
CREATE POLICY "funcao_pacotes_serrados_excluir" ON public.pacotes_serrados FOR DELETE TO authenticated USING (public.pode_funcao(empresa_id,'serraria_operar'));

ALTER TABLE public.itens_pacote_serrado ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funcao_itens_pacote_serrado_ler" ON public.itens_pacote_serrado FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'serraria_ver'));
CREATE POLICY "funcao_itens_pacote_serrado_criar" ON public.itens_pacote_serrado FOR INSERT TO authenticated WITH CHECK (public.pode_funcao(empresa_id,'serraria_operar'));
CREATE POLICY "funcao_itens_pacote_serrado_editar" ON public.itens_pacote_serrado FOR UPDATE TO authenticated USING (public.pode_funcao(empresa_id,'serraria_operar')) WITH CHECK (public.pode_funcao(empresa_id,'serraria_operar'));
CREATE POLICY "funcao_itens_pacote_serrado_excluir" ON public.itens_pacote_serrado FOR DELETE TO authenticated USING (public.pode_funcao(empresa_id,'serraria_operar'));

ALTER TABLE public.romaneios_madeira_serrada ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funcao_romaneios_madeira_serrada_ler" ON public.romaneios_madeira_serrada FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'serraria_ver'));
CREATE POLICY "funcao_romaneios_madeira_serrada_criar" ON public.romaneios_madeira_serrada FOR INSERT TO authenticated WITH CHECK (public.pode_funcao(empresa_id,'serraria_operar'));
CREATE POLICY "funcao_romaneios_madeira_serrada_editar" ON public.romaneios_madeira_serrada FOR UPDATE TO authenticated USING (public.pode_funcao(empresa_id,'serraria_operar')) WITH CHECK (public.pode_funcao(empresa_id,'serraria_operar'));
CREATE POLICY "funcao_romaneios_madeira_serrada_excluir" ON public.romaneios_madeira_serrada FOR DELETE TO authenticated USING (public.pode_funcao(empresa_id,'serraria_operar'));

ALTER TABLE public.romaneio_carga_pacotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funcao_romaneio_carga_pacotes_ler" ON public.romaneio_carga_pacotes FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'serraria_ver'));
CREATE POLICY "funcao_romaneio_carga_pacotes_criar" ON public.romaneio_carga_pacotes FOR INSERT TO authenticated WITH CHECK (public.pode_funcao(empresa_id,'serraria_operar'));
CREATE POLICY "funcao_romaneio_carga_pacotes_editar" ON public.romaneio_carga_pacotes FOR UPDATE TO authenticated USING (public.pode_funcao(empresa_id,'serraria_operar')) WITH CHECK (public.pode_funcao(empresa_id,'serraria_operar'));
CREATE POLICY "funcao_romaneio_carga_pacotes_excluir" ON public.romaneio_carga_pacotes FOR DELETE TO authenticated USING (public.pode_funcao(empresa_id,'serraria_operar'));

ALTER TABLE public.registros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funcao_registros_ler" ON public.registros FOR SELECT TO authenticated USING (public.pode_funcao(empresa_id,'registros_ver'));


-- Cortador pode alterar só a localização e o estado de abate; não pode
-- sobrescrever inventário, número da árvore, AUTEX, espécie ou empresa.
CREATE OR REPLACE FUNCTION public.restringir_edicao_arvore_por_cargo()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF public.pode_funcao(NEW.empresa_id,'usuarios_gerenciar') THEN RETURN NEW; END IF;
  IF NOT public.pode_funcao(NEW.empresa_id,'mapa_abater')
    THEN RAISE EXCEPTION 'Seu cargo não pode editar árvores'; END IF;
  IF (to_jsonb(NEW) - ARRAY['latitude','longitude','gps_precisao','localizado_em','abatida_em','nao_abatida_motivo','nao_abatida_em'])
    IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['latitude','longitude','gps_precisao','localizado_em','abatida_em','nao_abatida_motivo','nao_abatida_em'])
    THEN RAISE EXCEPTION 'Cortador não pode alterar cadastro, AUTEX ou medidas da árvore'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS restringir_edicao_arvore_cargo ON public.arvores;
CREATE TRIGGER restringir_edicao_arvore_cargo BEFORE UPDATE ON public.arvores
FOR EACH ROW EXECUTE FUNCTION public.restringir_edicao_arvore_por_cargo();

-- A tabela de registros só aceita mudanças por RPC autenticada/segura.
REVOKE INSERT,UPDATE,DELETE ON public.registros FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.registros TO authenticated;
COMMIT;

-- Validação obrigatória em homologação:
-- cortador abate mas não edita espécie; tratorista arrasta mas não abate;
-- romaneador cadastra explanadas/toras, não gera cargas; motorista carrega;
-- gerente_patio atua na serraria; gerente_escritorio lê e exporta, sem alterar.
-- superadmin acessa múltiplas empresas; admin só a sua.
-- RPCs SECURITY DEFINER ignoram RLS: não concluir a implantação sem protegê-las.
