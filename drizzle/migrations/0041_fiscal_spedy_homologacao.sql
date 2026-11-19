CREATE OR REPLACE FUNCTION public.pode_fiscal(_empresa uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND _empresa IS NOT NULL AND (
    public.has_role(auth.uid(), 'superadmin')
    OR (public.has_role(auth.uid(), 'admin') AND EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu WHERE eu.user_id = auth.uid() AND eu.empresa_id = _empresa))
  )
$$;
REVOKE ALL ON FUNCTION public.pode_fiscal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_fiscal(uuid) TO authenticated;

CREATE TABLE public.fiscal_config (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id),
  spedy_company_id text,
  cnpj text,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.fiscal_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  rascunho_id text NOT NULL CHECK (length(rascunho_id) BETWEEN 1 AND 120),
  origem text,
  ambiente text NOT NULL DEFAULT 'development' CHECK (ambiente = 'development'),
  status text NOT NULL DEFAULT 'preparada',
  payload_hash text,
  spedy_id text,
  numero text,
  serie text,
  chave_acesso text,
  protocolo text,
  mensagem text,
  tentativa_em timestamptz,
  enviado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, rascunho_id)
);
CREATE TABLE public.fiscal_inutilizacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  serie int NOT NULL CHECK (serie BETWEEN 0 AND 999),
  inicio int NOT NULL CHECK (inicio > 0),
  fim int NOT NULL,
  justificativa text NOT NULL CHECK (length(btrim(justificativa)) BETWEEN 15 AND 255),
  ambiente text NOT NULL DEFAULT 'development' CHECK (ambiente = 'development'),
  status text NOT NULL DEFAULT 'preparada',
  spedy_id text,
  protocolo text,
  mensagem text,
  tentativa_em timestamptz,
  enviado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CHECK (fim >= inicio AND fim - inicio < 10000),
  UNIQUE (empresa_id, serie, inicio, fim)
);
CREATE TABLE public.fiscal_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  documento_id uuid REFERENCES public.fiscal_documentos(id),
  inutilizacao_id uuid REFERENCES public.fiscal_inutilizacoes(id),
  acao text NOT NULL,
  resultado text,
  usuario_id uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fiscal_eventos_empresa_idx ON public.fiscal_eventos(empresa_id, criado_em DESC);

GRANT SELECT ON public.fiscal_config, public.fiscal_documentos, public.fiscal_inutilizacoes, public.fiscal_eventos TO authenticated;
GRANT ALL ON public.fiscal_config, public.fiscal_documentos, public.fiscal_inutilizacoes, public.fiscal_eventos TO service_role;

ALTER TABLE public.fiscal_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_inutilizacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal le config" ON public.fiscal_config FOR SELECT TO authenticated USING (public.pode_fiscal(empresa_id));
CREATE POLICY "fiscal le documentos" ON public.fiscal_documentos FOR SELECT TO authenticated USING (public.pode_fiscal(empresa_id));
CREATE POLICY "fiscal le inutilizacoes" ON public.fiscal_inutilizacoes FOR SELECT TO authenticated USING (public.pode_fiscal(empresa_id));
CREATE POLICY "fiscal le eventos" ON public.fiscal_eventos FOR SELECT TO authenticated USING (public.pode_fiscal(empresa_id));