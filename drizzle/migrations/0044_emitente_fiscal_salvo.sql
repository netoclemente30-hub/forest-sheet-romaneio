CREATE TABLE public.empresa_emitente (empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE, cadastro jsonb NOT NULL DEFAULT '{}'::jsonb, atualizado_em timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE ON public.empresa_emitente TO authenticated;
GRANT ALL ON public.empresa_emitente TO service_role;
ALTER TABLE public.empresa_emitente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fiscal le emitente" ON public.empresa_emitente FOR SELECT TO authenticated USING (public.pode_fiscal(empresa_id));
CREATE POLICY "fiscal cria emitente" ON public.empresa_emitente FOR INSERT TO authenticated WITH CHECK (public.pode_fiscal(empresa_id));
CREATE POLICY "fiscal altera emitente" ON public.empresa_emitente FOR UPDATE TO authenticated USING (public.pode_fiscal(empresa_id)) WITH CHECK (public.pode_fiscal(empresa_id));