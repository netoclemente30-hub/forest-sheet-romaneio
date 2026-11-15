-- PROPOSTA PARA HOMOLOGAÇÃO, NÃO EXECUTADA.
-- A Lovable gerencia as migrações deste projeto (ver AGENTS.md).
-- NÃO aplicar parcialmente: habilitar cargos, RLS e todas as RPCs protegidas
-- em uma transação controlada depois de validar em banco isolado.

-- Um cargo operacional por usuário, vinculado à empresa da sua conta.
CREATE TABLE IF NOT EXISTS public.funcoes_funcionarios (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  funcao text NOT NULL CHECK (funcao IN (
    'cortador','tratorista','romaneador','motorista',
    'gerente_patio','gerente_escritorio'
  )),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS funcoes_empresa_idx ON public.funcoes_funcionarios(empresa_id);
ALTER TABLE public.funcoes_funcionarios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.funcoes_funcionarios FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.funcoes_funcionarios TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.funcoes_funcionarios TO service_role;

-- Somente o próprio usuário vê seu cargo diretamente; administradores
-- podem gerenciar cargos pela função servidor com chave service_role.
DROP POLICY IF EXISTS "ler propria funcao" ON public.funcoes_funcionarios;
CREATE POLICY "ler propria funcao" ON public.funcoes_funcionarios FOR SELECT
TO authenticated USING (user_id=auth.uid());

CREATE OR REPLACE FUNCTION public.minha_funcao()
RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$
  SELECT f.funcao
  FROM public.funcoes_funcionarios f
  JOIN public.empresa_usuarios eu ON eu.user_id=f.user_id AND eu.empresa_id=f.empresa_id
  WHERE f.user_id=auth.uid()
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.minha_funcao() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.minha_funcao() TO authenticated;

-- Uma permissão válida sempre depende da associação real do usuário à empresa,
-- mesmo que o aplicativo seja manipulado ou a conta esteja num celular compartilhado.
CREATE OR REPLACE FUNCTION public.pode_funcao(_empresa uuid, _acao text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE f text;
BEGIN
  IF auth.uid() IS NULL OR _empresa IS NULL THEN RETURN false; END IF;
  IF public.has_role(auth.uid(),'superadmin') THEN RETURN true; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.user_id=auth.uid() AND eu.empresa_id=_empresa
  ) THEN RETURN false; END IF;
  IF public.has_role(auth.uid(),'admin') THEN RETURN true; END IF;
  SELECT ff.funcao INTO f FROM public.funcoes_funcionarios ff
  WHERE ff.user_id=auth.uid() AND ff.empresa_id=_empresa;
  IF f IS NULL THEN RETURN false; END IF;

  CASE _acao
    WHEN 'mapa_ver' THEN RETURN f IN ('cortador','tratorista','romaneador','gerente_escritorio');
    WHEN 'mapa_abater' THEN RETURN f='cortador';
    WHEN 'mapa_arrastar' THEN RETURN f='tratorista';
    WHEN 'mapa_rastrear' THEN RETURN f IN ('cortador','tratorista');
    WHEN 'toras_ver' THEN RETURN f IN ('romaneador','tratorista','motorista','gerente_patio','gerente_escritorio');
    WHEN 'toras_lancar' THEN RETURN f='romaneador';
    WHEN 'patios_criar' THEN RETURN f='romaneador';
    WHEN 'carga_criar','nfe_txt' THEN RETURN f='motorista';
    WHEN 'serraria_ver','relatorios_serraria' THEN RETURN f IN ('gerente_patio','gerente_escritorio');
    WHEN 'serraria_operar' THEN RETURN f='gerente_patio';
    WHEN 'relatorios','registros_ver','informacoes_ver' THEN RETURN f='gerente_escritorio';
    WHEN 'registros_reverter','usuarios_gerenciar','base_importar' THEN RETURN false;
    ELSE RETURN false;
  END CASE;
END $$;
REVOKE ALL ON FUNCTION public.pode_funcao(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pode_funcao(uuid,text) TO authenticated;

-- A explanada é um ponto de entrega na FLORESTA, distinto dos pátios da serraria.
CREATE TABLE IF NOT EXISTS public.explanadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  autex text NOT NULL,
  nome text NOT NULL CHECK (length(btrim(nome)) BETWEEN 2 AND 80),
  latitude double precision,
  longitude double precision,
  criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  CONSTRAINT explanadas_coords_par CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
  ),
  UNIQUE (empresa_id,autex,nome)
);
CREATE UNIQUE INDEX IF NOT EXISTS explanadas_ref_empresa_autex_id_idx
ON public.explanadas(empresa_id,autex,id);
ALTER TABLE public.explanadas ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.explanadas TO authenticated;
GRANT ALL ON public.explanadas TO service_role;
DROP POLICY IF EXISTS "explanadas consulta" ON public.explanadas;
CREATE POLICY "explanadas consulta" ON public.explanadas FOR SELECT TO authenticated
USING (public.pode_funcao(empresa_id,'mapa_ver') OR public.pode_funcao(empresa_id,'patios_criar'));
DROP POLICY IF EXISTS "explanadas criação romaneador" ON public.explanadas;
CREATE POLICY "explanadas criação romaneador" ON public.explanadas FOR INSERT TO authenticated
WITH CHECK (
  public.pode_funcao(empresa_id,'patios_criar')
  AND (criado_por IS NULL OR criado_por=auth.uid())
);

-- Apenas administrador pode corrigir ou excluir explanadas já cadastradas.
DROP POLICY IF EXISTS "explanadas editar admin" ON public.explanadas;
CREATE POLICY "explanadas editar admin" ON public.explanadas FOR UPDATE TO authenticated
USING (public.pode_funcao(empresa_id,'usuarios_gerenciar'))
WITH CHECK (public.pode_funcao(empresa_id,'usuarios_gerenciar'));
DROP POLICY IF EXISTS "explanadas excluir admin" ON public.explanadas;
CREATE POLICY "explanadas excluir admin" ON public.explanadas FOR DELETE TO authenticated
USING (public.pode_funcao(empresa_id,'usuarios_gerenciar'));

-- Garantir que a explanada de destino de uma tora pertence à mesma empresa e AUTEX.
-- Adiciona somente colunas novas, não recalcula nem move toras anteriores.
ALTER TABLE public.toras ADD COLUMN IF NOT EXISTS arrasto_explanada_id uuid;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='toras_arrasto_explanada_empresa_autex_fkey') THEN
    ALTER TABLE public.toras ADD CONSTRAINT toras_arrasto_explanada_empresa_autex_fkey
      FOREIGN KEY (empresa_id,autex,arrasto_explanada_id)
      REFERENCES public.explanadas(empresa_id,autex,id) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.toras VALIDATE CONSTRAINT toras_arrasto_explanada_empresa_autex_fkey;

-- A seguir, instalar também docs/propostas/controle-acesso-rls.sql e
-- docs/propostas/controle-acesso-rpcs.sql.
-- Sem eles, o gerente de escritório ainda poderia chamar APIs privilegiadas!
