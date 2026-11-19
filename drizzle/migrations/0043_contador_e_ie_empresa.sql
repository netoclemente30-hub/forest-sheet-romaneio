ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS ie text;
UPDATE public.empresas SET cnpj = '50165504000130', ie = '6622801' WHERE id = 'a0000000-0000-0000-0000-000000000001';

CREATE TABLE public.empresa_contador (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  escritorio text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  envio_automatico boolean NOT NULL DEFAULT true,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.empresa_contador TO authenticated;
GRANT ALL ON public.empresa_contador TO service_role;
ALTER TABLE public.empresa_contador ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fiscal le contador" ON public.empresa_contador FOR SELECT TO authenticated USING (public.pode_fiscal(empresa_id));
CREATE POLICY "fiscal cria contador" ON public.empresa_contador FOR INSERT TO authenticated WITH CHECK (public.pode_fiscal(empresa_id));
CREATE POLICY "fiscal altera contador" ON public.empresa_contador FOR UPDATE TO authenticated USING (public.pode_fiscal(empresa_id)) WITH CHECK (public.pode_fiscal(empresa_id));