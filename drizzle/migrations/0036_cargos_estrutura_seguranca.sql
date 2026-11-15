-- Base estrutural revisada de 0036/0037 + cargos. Não altera linhas existentes.
DROP POLICY IF EXISTS "usuario le proprio vinculo" ON public.empresa_usuarios;
CREATE POLICY "usuario le proprio vinculo" ON public.empresa_usuarios
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (empresa_id = public.minha_empresa() AND public.has_role(auth.uid(),'admin'))
  OR public.has_role(auth.uid(),'superadmin')
);

DROP POLICY IF EXISTS "admin gerencia empresas" ON public.empresas;
DROP POLICY IF EXISTS "superadmin gerencia empresas" ON public.empresas;
DROP POLICY IF EXISTS "somente superadmin gerencia empresas" ON public.empresas;
CREATE POLICY "somente superadmin gerencia empresas" ON public.empresas
FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'superadmin'))
WITH CHECK (public.has_role(auth.uid(),'superadmin'));

DROP POLICY IF EXISTS "usuario le a propria empresa" ON public.empresas;
CREATE POLICY "usuario le a propria empresa" ON public.empresas
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.empresa_id = empresas.id AND eu.user_id = auth.uid())
  OR public.has_role(auth.uid(),'superadmin')
);

REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

ALTER TABLE public.romaneios ADD COLUMN IF NOT EXISTS operacao_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS romaneios_operacao_unica ON public.romaneios(operacao_id) WHERE operacao_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS romaneios_empresa_id_id_unique ON public.romaneios(empresa_id,id);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='toras_romaneio_empresa_fkey') THEN
    ALTER TABLE public.toras ADD CONSTRAINT toras_romaneio_empresa_fkey
      FOREIGN KEY (empresa_id,romaneio_id) REFERENCES public.romaneios(empresa_id,id)
      ON DELETE SET NULL (romaneio_id) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.toras VALIDATE CONSTRAINT toras_romaneio_empresa_fkey;

-- Cargos operacionais
CREATE TABLE IF NOT EXISTS public.funcoes_funcionarios (
  user_id uuid PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  funcao text NOT NULL CHECK (funcao IN ('cortador','tratorista','romaneador','motorista','gerente_patio','gerente_escritorio')),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS funcoes_empresa_idx ON public.funcoes_funcionarios(empresa_id);
REVOKE ALL ON public.funcoes_funcionarios FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.funcoes_funcionarios TO authenticated;
GRANT ALL ON public.funcoes_funcionarios TO service_role;
ALTER TABLE public.funcoes_funcionarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ler propria funcao" ON public.funcoes_funcionarios;
CREATE POLICY "ler propria funcao" ON public.funcoes_funcionarios FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.minha_funcao()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT f.funcao FROM public.funcoes_funcionarios f
  JOIN public.empresa_usuarios eu ON eu.user_id = f.user_id AND eu.empresa_id = f.empresa_id
  WHERE f.user_id = auth.uid() LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.minha_funcao() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.minha_funcao() TO authenticated;

-- Autorização única do banco: empresa real do usuário + cargo. Sem cargo = negado.
CREATE OR REPLACE FUNCTION public.pode_funcao(_empresa uuid, _acao text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE f text;
BEGIN
  IF auth.uid() IS NULL OR _empresa IS NULL THEN RETURN false; END IF;
  IF public.has_role(auth.uid(),'superadmin') THEN RETURN true; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.user_id = auth.uid() AND eu.empresa_id = _empresa) THEN RETURN false; END IF;
  IF public.has_role(auth.uid(),'admin') THEN RETURN true; END IF;
  SELECT ff.funcao INTO f FROM public.funcoes_funcionarios ff WHERE ff.user_id = auth.uid() AND ff.empresa_id = _empresa;
  IF f IS NULL THEN RETURN false; END IF;
  RETURN CASE _acao
    WHEN 'mapa_ver' THEN f IN ('cortador','tratorista','romaneador','gerente_escritorio')
    WHEN 'mapa_abater' THEN f = 'cortador'
    WHEN 'mapa_arrastar' THEN f = 'tratorista'
    WHEN 'mapa_rastrear' THEN f IN ('cortador','tratorista')
    WHEN 'toras_ver' THEN f IN ('romaneador','tratorista','motorista','gerente_patio','gerente_escritorio')
    WHEN 'toras_lancar' THEN f = 'romaneador'
    WHEN 'patios_criar' THEN f = 'romaneador'
    WHEN 'carga_criar' THEN f = 'motorista'
    WHEN 'nfe_txt' THEN f = 'motorista'
    WHEN 'carga_consultar' THEN f IN ('motorista','gerente_patio','gerente_escritorio')
    WHEN 'serraria_ver' THEN f IN ('gerente_patio','gerente_escritorio')
    WHEN 'relatorios_serraria' THEN f IN ('gerente_patio','gerente_escritorio')
    WHEN 'serraria_operar' THEN f = 'gerente_patio'
    WHEN 'relatorios' THEN f IN ('gerente_patio','gerente_escritorio')
    WHEN 'registros_ver' THEN f = 'gerente_escritorio'
    WHEN 'informacoes_ver' THEN f = 'gerente_escritorio'
    ELSE false
  END;
END $$;
REVOKE ALL ON FUNCTION public.pode_funcao(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_funcao(uuid,text) TO authenticated;

-- Explanadas (entrega na floresta)
CREATE TABLE IF NOT EXISTS public.explanadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  autex text NOT NULL,
  nome text NOT NULL CHECK (length(btrim(nome)) BETWEEN 2 AND 80),
  latitude double precision,
  longitude double precision,
  criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid DEFAULT auth.uid(),
  CONSTRAINT explanadas_coords_par CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
  ),
  UNIQUE (empresa_id, autex, nome)
);
CREATE UNIQUE INDEX IF NOT EXISTS explanadas_ref_empresa_autex_id_idx ON public.explanadas(empresa_id, autex, id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.explanadas TO authenticated;
GRANT ALL ON public.explanadas TO service_role;
ALTER TABLE public.explanadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "explanadas consulta" ON public.explanadas FOR SELECT TO authenticated
USING (public.pode_funcao(empresa_id,'mapa_ver') OR public.pode_funcao(empresa_id,'patios_criar'));
CREATE POLICY "explanadas criação romaneador" ON public.explanadas FOR INSERT TO authenticated
WITH CHECK (public.pode_funcao(empresa_id,'patios_criar') AND (criado_por IS NULL OR criado_por = auth.uid()));
CREATE POLICY "explanadas editar admin" ON public.explanadas FOR UPDATE TO authenticated
USING (public.pode_funcao(empresa_id,'usuarios_gerenciar')) WITH CHECK (public.pode_funcao(empresa_id,'usuarios_gerenciar'));
CREATE POLICY "explanadas excluir admin" ON public.explanadas FOR DELETE TO authenticated
USING (public.pode_funcao(empresa_id,'usuarios_gerenciar'));

-- Arrasto: colunas novas, todas nulas
ALTER TABLE public.toras ADD COLUMN IF NOT EXISTS arrasto_explanada_id uuid;
ALTER TABLE public.toras ADD COLUMN IF NOT EXISTS arrastada_em timestamptz;
ALTER TABLE public.toras ADD COLUMN IF NOT EXISTS arrastada_por uuid;
ALTER TABLE public.toras ADD COLUMN IF NOT EXISTS arrasto_operacao_id uuid;
ALTER TABLE public.toras ADD COLUMN IF NOT EXISTS arrasto_lat double precision;
ALTER TABLE public.toras ADD COLUMN IF NOT EXISTS arrasto_lng double precision;
CREATE INDEX IF NOT EXISTS toras_arrastadas_empresa_dia_idx ON public.toras (empresa_id, arrastada_em) WHERE arrastada_em IS NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='toras_arrasto_explanada_empresa_autex_fkey') THEN
    ALTER TABLE public.toras ADD CONSTRAINT toras_arrasto_explanada_empresa_autex_fkey
      FOREIGN KEY (empresa_id, autex, arrasto_explanada_id) REFERENCES public.explanadas(empresa_id, autex, id) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.toras VALIDATE CONSTRAINT toras_arrasto_explanada_empresa_autex_fkey;