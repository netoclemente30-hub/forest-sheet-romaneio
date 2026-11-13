ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativa';
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS cnpj text;
ALTER TABLE public.empresas ADD CONSTRAINT empresas_status_valido CHECK (status IN ('demonstracao','ativa','inativa'));
CREATE UNIQUE INDEX IF NOT EXISTS empresas_cnpj_unico ON public.empresas (cnpj) WHERE cnpj IS NOT NULL;

DROP POLICY IF EXISTS "admin gerencia empresas" ON public.empresas;
CREATE POLICY "superadmin gerencia empresas" ON public.empresas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'::app_role));

CREATE OR REPLACE FUNCTION public.minha_empresa_situacao()
RETURNS TABLE(status text, toras integer, limite integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.status, (SELECT count(*)::int FROM public.toras t WHERE t.empresa_id = e.id), 50
  FROM public.empresas e WHERE e.id = public.minha_empresa();
$$;
GRANT EXECUTE ON FUNCTION public.minha_empresa_situacao() TO authenticated;

CREATE OR REPLACE FUNCTION public.limitar_toras_empresa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _status text; _qtd int;
BEGIN
  SELECT status INTO _status FROM public.empresas WHERE id = NEW.empresa_id;
  IF _status = 'inativa' THEN
    RAISE EXCEPTION 'Empresa inativa. Peça a liberação pelo WhatsApp (69) 99900-4121.';
  END IF;
  IF _status = 'demonstracao' THEN
    SELECT count(*) INTO _qtd FROM public.toras WHERE empresa_id = NEW.empresa_id;
    IF _qtd >= 50 THEN
      RAISE EXCEPTION 'Limite da demonstração atingido (50 toras). Peça a liberação pelo WhatsApp (69) 99900-4121.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS limitar_toras_empresa ON public.toras;
CREATE TRIGGER limitar_toras_empresa BEFORE INSERT ON public.toras
  FOR EACH ROW EXECUTE FUNCTION public.limitar_toras_empresa();