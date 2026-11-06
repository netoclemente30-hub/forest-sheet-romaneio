CREATE TABLE public.saldos (
  empresa_id uuid PRIMARY KEY DEFAULT public.minha_empresa() REFERENCES public.empresas(id) ON DELETE CASCADE,
  linhas jsonb NOT NULL DEFAULT '[]'::jsonb,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saldos TO authenticated;
GRANT ALL ON public.saldos TO service_role;
ALTER TABLE public.saldos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "empresa saldos" ON public.saldos FOR ALL TO authenticated
USING (empresa_id = public.minha_empresa() OR public.has_role(auth.uid(),'superadmin'))
WITH CHECK (empresa_id = public.minha_empresa() OR public.has_role(auth.uid(),'superadmin'));