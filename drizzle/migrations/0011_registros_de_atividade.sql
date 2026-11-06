CREATE TABLE public.registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid DEFAULT public.minha_empresa() REFERENCES public.empresas(id),
  user_id uuid,
  user_email text,
  acao text NOT NULL,
  detalhe text,
  lat double precision,
  lng double precision,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.registros TO authenticated;
GRANT ALL ON public.registros TO service_role;

ALTER TABLE public.registros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresa registros select" ON public.registros FOR SELECT TO authenticated
  USING (empresa_id = public.minha_empresa() OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "empresa registros insert" ON public.registros FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.minha_empresa() OR public.has_role(auth.uid(), 'superadmin'));

CREATE TRIGGER trg_empresa_registros BEFORE INSERT ON public.registros
  FOR EACH ROW EXECUTE FUNCTION public.definir_empresa_id();