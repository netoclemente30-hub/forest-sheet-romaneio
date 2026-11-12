CREATE TABLE public.toras_aguardando (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.minha_empresa(),
  numero integer NOT NULL CHECK (numero > 0),
  especie text NOT NULL CHECK (length(trim(especie)) > 0),
  nome_cientifico text,
  d_topo1 numeric NOT NULL CHECK (d_topo1 > 0),
  d_topo2 numeric NOT NULL CHECK (d_topo2 > 0),
  d_pe1 numeric NOT NULL CHECK (d_pe1 > 0),
  d_pe2 numeric NOT NULL CHECK (d_pe2 > 0),
  comprimento numeric NOT NULL CHECK (comprimento > 0),
  volume numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, numero)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toras_aguardando TO authenticated;
GRANT ALL ON public.toras_aguardando TO service_role;
ALTER TABLE public.toras_aguardando ENABLE ROW LEVEL SECURITY;
CREATE POLICY "empresa le toras aguardando" ON public.toras_aguardando FOR SELECT TO authenticated USING (empresa_id = public.minha_empresa() OR public.has_role(auth.uid(),'superadmin'));
CREATE POLICY "empresa insere toras aguardando" ON public.toras_aguardando FOR INSERT TO authenticated WITH CHECK (empresa_id = public.minha_empresa());
CREATE POLICY "empresa altera toras aguardando" ON public.toras_aguardando FOR UPDATE TO authenticated USING (empresa_id = public.minha_empresa()) WITH CHECK (empresa_id = public.minha_empresa());
CREATE POLICY "empresa exclui toras aguardando" ON public.toras_aguardando FOR DELETE TO authenticated USING (empresa_id = public.minha_empresa());